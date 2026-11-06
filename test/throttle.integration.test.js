import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import pg from 'pg';

const url = process.env.TEST_DATABASE_URL;
test('login throttle is shared across instances and fails closed when store fails', {skip:!url ? 'Set TEST_DATABASE_URL to a disposable PostgreSQL database' : false}, async () => {
  const schema = 'test_' + randomUUID().replaceAll('-','');
  const admin = new pg.Pool({connectionString:url});
  await admin.query(`CREATE SCHEMA ${schema}`);
  const isolated = new URL(url); isolated.searchParams.set('options', `-c search_path=${schema}`);
  const db = new pg.Pool({connectionString:isolated.toString()});
  const children=[];
  try {
    for (const file of ['001_initial.sql','002_login_throttle.sql']) await db.query(await readFile(new URL(`../migrations/${file}`,import.meta.url),'utf8'));
    for (const port of [4191,4192]) {
      const child=spawn(process.execPath,['src/server.js'],{cwd:process.cwd(),env:{...process.env,DATABASE_URL:isolated.toString(),APP_ORIGIN:'http://test.local',PORT:String(port)},stdio:'ignore'});
      children.push(child);
      let ready=false;
      for(let i=0;i<50;i++){try{await fetch(`http://127.0.0.1:${port}/`);ready=true;break;}catch{await new Promise(r=>setTimeout(r,100));}}
      assert.ok(ready,`server ${port} starts`);
    }
    const attempt = (port, forwarded='') => fetch(`http://127.0.0.1:${port}/api/auth/login`,{method:'POST',headers:{origin:'http://test.local','content-type':'application/json','x-forwarded-for':forwarded,'x-real-ip':forwarded,'x-vercel-forwarded-for':forwarded},body:JSON.stringify({email:'none@test.invalid',password:'wrong-password'})});
    const responses=await Promise.all(Array.from({length:20},(_,i)=>attempt(i%2?4191:4192,i%2 ? `192.0.2.${i}, 10.0.0.1` : 'not-an-ip')));
    assert.deepEqual(responses.map(r=>r.status).sort(),Array(20).fill(401));
    assert.equal((await db.query('SELECT count(*)::int AS n FROM login_throttles')).rows[0].n,1);
    assert.equal((await attempt(4191,'203.0.113.42')).status,429);
    assert.equal((await attempt(4192,'invalid,spoofed')).status,429);
    assert.equal((await db.query("SELECT count(*)::int AS n FROM audit_events WHERE action='LOGIN_THROTTLED' AND result='denied'")).rows[0].n,2);
    await db.query('UPDATE login_throttles SET attempts=2147483647');
    assert.equal((await attempt(4191)).status,429,'a saturated counter continues to throttle without integer overflow');
    assert.equal((await db.query('SELECT attempts FROM login_throttles')).rows[0].attempts,21);
    await db.query('ALTER TABLE login_throttles RENAME TO login_throttles_unavailable');
    assert.equal((await attempt(4191)).status,503);
  } finally {
    await Promise.all(children.map(child=>new Promise(resolve=>{if(child.exitCode!==null) return resolve();child.once('exit',resolve);child.kill('SIGTERM');})));
    await db.end(); await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end();
  }
});
