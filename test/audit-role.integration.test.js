import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import pg from 'pg';
import { hashPassword } from '../src/auth-crypto.js';
const url=process.env.TEST_DATABASE_URL;
test('separate local runtime role can append but cannot rewrite audit history', {skip:!url?'Set TEST_DATABASE_URL to a disposable PostgreSQL database':false},async()=>{
  const suffix=randomUUID().replaceAll('-','');
  const schema='test_'+suffix, app='tv_app_'+suffix, reader='tv_reader_'+suffix;
  const admin=new pg.Client({connectionString:url});await admin.connect();
  const storage=await mkdtemp(join(tmpdir(),'trustvault-role-'));
  let appCreated=false,readerCreated=false,server;
  try {
    await admin.query(`CREATE SCHEMA ${schema}`);
    await admin.query(`SET search_path TO ${schema}`);
    for(const name of ['001_initial.sql','002_login_throttle.sql']) await admin.query(await readFile(new URL(`../migrations/${name}`,import.meta.url),'utf8'));
    await admin.query(`CREATE ROLE ${app} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT`);appCreated=true;
    await admin.query(`CREATE ROLE ${reader} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT`);readerCreated=true;
    const template=await readFile(new URL('../ops/grant-runtime-privileges.sql',import.meta.url),'utf8');
    await admin.query(template.replaceAll(':"schema_name"',`"${schema}"`).replaceAll(':"app_role"',`"${app}"`));
    await admin.query(`GRANT USAGE ON SCHEMA ${schema} TO ${reader}`);
    await admin.query(`GRANT SELECT ON ${schema}.audit_events TO ${reader}`);
    const password=await hashPassword('local-role-test-password');
    await admin.query(`INSERT INTO ${schema}.users(id,email,password_hash,role) VALUES($1,$2,$3,'OWNER')`,[randomUUID(),'role-owner@test.invalid',password]);
    await admin.query(`SET ROLE ${app}`);
    await admin.query(`INSERT INTO ${schema}.audit_events(event_id,occurred_at,action,result,previous_hash,current_hash) VALUES($1,now(),'TEST','success',$2,$3)`,[randomUUID(),'0'.repeat(64),'1'.repeat(64)]);
    assert.equal((await admin.query(`SELECT count(*)::int AS n FROM ${schema}.audit_events`)).rows[0].n,1);
    for(const sql of [`UPDATE ${schema}.audit_events SET action='TAMPERED'`,`DELETE FROM ${schema}.audit_events`,`TRUNCATE ${schema}.audit_events`,`ALTER TABLE ${schema}.audit_events DISABLE TRIGGER ALL`]) await assert.rejects(admin.query(sql),{code:'42501'});
    await assert.rejects(admin.query(`UPDATE ${schema}.users SET role='ADMIN'`),{code:'42501'});
    await assert.rejects(admin.query(`DELETE FROM ${schema}.users`),{code:'42501'});
    await admin.query('RESET ROLE');
    await admin.query(`SET ROLE ${reader}`);
    assert.equal((await admin.query(`SELECT count(*)::int AS n FROM ${schema}.audit_events`)).rows[0].n,1);
    await assert.rejects(admin.query(`INSERT INTO ${schema}.audit_events(event_id,occurred_at,action,result,previous_hash,current_hash) VALUES($1,now(),'TEST','success',$2,$3)`,[randomUUID(),'0'.repeat(64),'1'.repeat(64)]),{code:'42501'});
    await admin.query('RESET ROLE');
    // Run the real API with PostgreSQL sessions assuming only the runtime role.
    const isolated=new URL(url);isolated.searchParams.set('options',`-c search_path=${schema} -c role=${app}`);
    const origin='http://127.0.0.1:4195';
    server=spawn(process.execPath,['src/server.js'],{cwd:process.cwd(),env:{...process.env,DATABASE_URL:isolated.toString(),APP_ORIGIN:origin,PORT:'4195',STORAGE_DIR:storage},stdio:'ignore'});
    let ready=false;for(let i=0;i<50;i++){try{await fetch(origin);ready=true;break;}catch{await new Promise(resolve=>setTimeout(resolve,100));}}
    assert.ok(ready,'restricted-role API starts');
    const login=await fetch(origin+'/api/auth/login',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({email:'role-owner@test.invalid',password:'local-role-test-password'})});
    assert.equal(login.status,200);
    const cookie=login.headers.get('set-cookie').split(';')[0];
    const form=new FormData();form.set('category','synthetic');form.set('file',new Blob(['%PDF-role-test'],{type:'application/pdf'}),'role.pdf');
    assert.equal((await fetch(origin+'/api/documents',{method:'POST',headers:{origin,cookie},body:form})).status,201);
  } finally {
    if(server && server.exitCode===null) {await new Promise(resolve=>{server.once('exit',resolve);server.kill('SIGTERM');});}
    await admin.query('RESET ROLE');
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    for(const [created,role] of [[appCreated,app],[readerCreated,reader]]) if(created) {await admin.query(`DROP OWNED BY ${role}`);await admin.query(`DROP ROLE ${role}`);}
    await admin.end();
    await rm(storage,{recursive:true,force:true});
  }
});
