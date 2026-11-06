import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { hashPassword, verifyPassword } from '../src/auth-crypto.js';

const url=process.env.TEST_DATABASE_URL, run=promisify(execFile);
test('staging demo rotation is scoped, atomic, audited and invalidates sessions', {skip:!url?'Set TEST_DATABASE_URL to a disposable PostgreSQL database':false}, async()=>{
  const schema='test_'+randomUUID().replaceAll('-',''), admin=new pg.Pool({connectionString:url});
  await admin.query(`CREATE SCHEMA ${schema}`);
  const isolated=new URL(url);isolated.searchParams.set('options',`-c search_path=${schema}`);
  const db=new pg.Pool({connectionString:isolated.toString()});
  try {
    await db.query(await readFile(new URL('../migrations/001_initial.sql',import.meta.url),'utf8'));
    const old=await hashPassword('old-synthetic-password');
    const addresses=['admin','owner','bob','viewer','dave'].map(name=>`${name}@trustvault.demo`);
    for(const email of [...addresses,'unrelated@test.invalid']){
      const id=randomUUID();await db.query("INSERT INTO users(id,email,password_hash,role) VALUES($1,$2,$3,'OWNER')",[id,email,old]);
      await db.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '1 hour')",[randomUUID(),id]);
    }
    const env={...process.env,NODE_ENV:'test',DATABASE_URL:isolated.toString(),DEMO_PASSWORD:'new-synthetic-password-2026'};
    await assert.rejects(run(process.execPath,['scripts/rotate-staging-demo-password.js'],{cwd:process.cwd(),env}));
    assert.equal((await db.query('SELECT count(*)::int AS n FROM sessions')).rows[0].n,6);
    const result=await run(process.execPath,['scripts/rotate-staging-demo-password.js'],{cwd:process.cwd(),env:{...env,CONFIRM_STAGING_DEMO_RESET:'staging-only'}});
    assert.doesNotMatch(result.stdout,/new-synthetic-password/);
    const users=(await db.query('SELECT email,password_hash FROM users ORDER BY email')).rows;
    for(const user of users) assert.equal(await verifyPassword(user.email==='unrelated@test.invalid'?'old-synthetic-password':'new-synthetic-password-2026',user.password_hash),true);
    assert.equal(new Set(users.filter(user=>addresses.includes(user.email)).map(user=>user.password_hash)).size,5);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM sessions')).rows[0].n,1);
    assert.equal((await db.query("SELECT count(*)::int AS n FROM audit_events WHERE action='STAGING_DEMO_CREDENTIALS_ROTATED' AND result='success'")).rows[0].n,1);
    await assert.rejects(run(process.execPath,['scripts/rotate-staging-demo-password.js'],{cwd:process.cwd(),env:{...env,NODE_ENV:'production',CONFIRM_STAGING_DEMO_RESET:'staging-only'}}));
    await db.query('DELETE FROM users WHERE email=$1',['dave@trustvault.demo']);
    const before=(await db.query('SELECT email,password_hash FROM users ORDER BY email')).rows;
    await assert.rejects(run(process.execPath,['scripts/rotate-staging-demo-password.js'],{cwd:process.cwd(),env:{...env,DEMO_PASSWORD:'another-synthetic-password',CONFIRM_STAGING_DEMO_RESET:'staging-only'}}));
    assert.deepEqual((await db.query('SELECT email,password_hash FROM users ORDER BY email')).rows,before);
    assert.equal((await db.query("SELECT count(*)::int AS n FROM audit_events WHERE action='STAGING_DEMO_CREDENTIALS_ROTATED'")).rows[0].n,1);
  } finally {await db.end();await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end();}
});
