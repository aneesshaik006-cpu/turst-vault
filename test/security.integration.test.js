import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID, createHash } from 'node:crypto';
import { readFile, mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import pg from 'pg';
import { hashPassword } from '../src/auth-crypto.js';
import { verifyAuditChain } from '../src/audit-verify.js';
import { writeCheckpoint, readCheckpoint } from '../src/checkpoint.js';

// This suite requires an explicitly supplied, disposable database, never production.
const url = process.env.TEST_DATABASE_URL;
const run = promisify(execFile);
test('document isolation, grants, revocation, deletion and search over HTTP', { skip: !url ? 'Set TEST_DATABASE_URL to an empty disposable PostgreSQL database' : false }, async () => {
  const schema = 'test_' + randomUUID().replaceAll('-', '');
  const admin = new pg.Pool({connectionString:url});
  await admin.query(`CREATE SCHEMA ${schema}`);
  const isolatedUrl = new URL(url);
  isolatedUrl.searchParams.set('options', `-c search_path=${schema}`);
  const db = new pg.Pool({connectionString:isolatedUrl.toString()});
  const origin='http://127.0.0.1:4189';
  let server;
  const root = await mkdtemp(join(tmpdir(),'trustvault-test-'));
  try {
    await db.query(await readFile(new URL('../migrations/001_initial.sql',import.meta.url),'utf8'));
    await db.query(await readFile(new URL('../migrations/002_login_throttle.sql',import.meta.url),'utf8'));
    const hash=await hashPassword('test-password-12345');
    for (const [email, role] of [['alice@test.invalid','OWNER'],['bob@test.invalid','OWNER'],['charlie@test.invalid','VIEWER'],['admin@test.invalid','ADMIN']]) await db.query('INSERT INTO users(id,email,password_hash,role) VALUES($1,$2,$3,$4)',[randomUUID(),email,hash,role]);
    server=spawn(process.execPath,['src/server.js'],{cwd:process.cwd(),env:{...process.env,DATABASE_URL:isolatedUrl.toString(),APP_ORIGIN:origin,PORT:'4189',STORAGE_DIR:root},stdio:'ignore'});
    let ready=false;
    for(let i=0;i<50;i++){try{await fetch(origin);ready=true;break;}catch{await new Promise(r=>setTimeout(r,100));}}
    assert.ok(ready,'test server starts');
    const malformed=await fetch(origin+'/api/auth/login',{method:'POST',headers:{origin,'content-type':'application/json'},body:'{'});
    assert.equal(malformed.status,400);
    assert.deepEqual(await malformed.json(),{error:'Invalid request body'});
    const excessive=await fetch(origin+'/api/auth/login',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({data:'x'.repeat(16385)})});
    assert.equal(excessive.status,413);
    assert.deepEqual(await excessive.json(),{error:'Request body too large'});
    async function login(email){const r=await fetch(origin+'/api/auth/login',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({email,password:'test-password-12345'})});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];}
    const alice=await login('alice@test.invalid'), bob=await login('bob@test.invalid'), charlie=await login('charlie@test.invalid'), adminCookie=await login('admin@test.invalid');
    const viewerId=(await db.query('SELECT id FROM users WHERE email=$1',['charlie@test.invalid'])).rows[0].id;
    const call=(cookie,path,opts={})=>fetch(origin+path,{...opts,headers:{origin,cookie,...opts.headers}});
    const invalidLogin = email => fetch(origin+'/api/auth/login',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({email,password:'incorrect'})});
    const [wrong,missing]=await Promise.all([invalidLogin('alice@test.invalid'),invalidLogin('missing@test.invalid')]);
    assert.equal(wrong.status,401);assert.equal(missing.status,401);assert.deepEqual(await wrong.json(),await missing.json());
    assert.equal((await fetch(origin+'/api/documents')).status,401);
    assert.equal((await call('trustvault_session=forged','/api/documents')).status,401);
    assert.equal((await fetch(origin+'/api/auth/login',{method:'POST',headers:{origin:'https://attacker.invalid','content-type':'application/json'},body:JSON.stringify({email:'alice@test.invalid',password:'test-password-12345'})})).status,403);
    for (const [name,type,contents,expected] of [['bad.exe','application/octet-stream','MZ',400],['fake.pdf','application/pdf','not a pdf',400],['empty.pdf','application/pdf','',400],['../escape.pdf','application/pdf','%PDF-test',400]]) {
      const bad=new FormData();bad.set('category','private');bad.set('file',new Blob([contents],{type}),name);
      assert.equal((await call(alice,'/api/documents',{method:'POST',body:bad})).status,expected,`reject ${name}`);
    }
    const huge=new FormData();huge.set('category','private');huge.set('file',new Blob([new Uint8Array(4*1024*1024+1)],{type:'application/pdf'}),'huge.pdf');
    assert.equal((await call(alice,'/api/documents',{method:'POST',body:huge})).status,413);
    assert.equal((await call(alice,'/api/documents',{method:'POST',headers:{'content-type':'multipart/form-data'},body:'broken'})).status,400);
    assert.equal((await call(alice,'/api/documents',{method:'POST'})).status,400);
    const forbiddenUpload=new FormData();forbiddenUpload.set('category','private');forbiddenUpload.set('file',new Blob(['%PDF-test'],{type:'application/pdf'}),'forbidden.pdf');
    assert.equal((await call(charlie,'/api/documents',{method:'POST',body:forbiddenUpload})).status,403);
    const uploadDenials=await db.query("SELECT actor_id,result,metadata FROM audit_events WHERE action='DOCUMENT_UPLOAD' AND result='denied'");
    assert.equal(uploadDenials.rowCount,8);
    assert.ok(uploadDenials.rows.some(event=>event.actor_id===viewerId && event.metadata.reason==='role'));
    const form=new FormData();form.set('category','private');form.set('file',new Blob(['%PDF-test fixture'],{type:'application/pdf'}),'secret.pdf');
    const uploaded=await call(alice,'/api/documents',{method:'POST',body:form});assert.equal(uploaded.status,201);const {id}=await uploaded.json();
    const storedKey=(await db.query('SELECT storage_key FROM documents WHERE id=$1',[id])).rows[0].storage_key;
    assert.equal((await fetch(`${origin}/.local/documents/${storedKey}`)).status,404);
    const search=await call(alice,'/api/documents?name=secret&owner=alice%40test.invalid&category=private');
    assert.equal(search.status,200);assert.equal(search.headers.get('cache-control'),'no-store');
    assert.equal((await search.json()).documents.length,1);
    for(const query of ['name=%25','name=%27%20OR%201%3D1--','owner=bob%40test.invalid','from=2099-01-01']) assert.equal((await (await call(alice,`/api/documents?${query}`)).json()).documents.length,0);
    for (const [method,path] of [['GET','/api/documents'],['GET',`/api/documents/${id}/download`],['GET',`/api/documents/${id}/permissions`],['PUT',`/api/documents/${id}/permissions`],['PATCH',`/api/documents/${id}`],['DELETE',`/api/documents/${id}`],['GET','/api/admin/activity']]) {
      const r=await fetch(origin+path,{method,headers:{origin,'content-type':'application/json'},...(method==='PUT'||method==='PATCH'?{body:'{}'}:{})});
      assert.equal(r.status,401,`${method} ${path} needs authentication`);
    }
    assert.equal((await call(bob,`/api/documents/${id}/download`)).status,404);
    assert.equal((await call(bob,`/api/documents/${id}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({name:'stolen.pdf',category:'private',role:'ADMIN',ownerId:'forged'})})).status,404);
    assert.equal((await call(bob,`/api/documents/${id}`,{method:'DELETE'})).status,404);
    assert.equal((await call(bob,`/api/documents/${id}/permissions`)).status,404);
    assert.equal((await (await call(bob,'/api/documents?name=secret.pdf')).json()).documents.length,0);
    const grant=await call(alice,`/api/documents/${id}/permissions`,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({email:'charlie@test.invalid',permission:'READ'})});assert.equal(grant.status,204);
    assert.equal((await call(alice,`/api/documents/${id}/permissions`)).status,200);
    for(const body of [{email:'alice@test.invalid',permission:'READ'},{email:'missing@test.invalid',permission:'READ'},{email:'charlie@test.invalid',permission:'ADMIN'}]) assert.equal((await call(alice,`/api/documents/${id}/permissions`,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(body)})).status,400);
    for(const attacker of [bob,charlie,adminCookie]) {
      assert.equal((await call(attacker,`/api/documents/${id}/permissions`,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({email:'bob@test.invalid',permission:'EDIT',ownerId:'forged',role:'ADMIN'})})).status,404);
      assert.equal((await call(attacker,`/api/documents/${id}/permissions/${viewerId}`,{method:'DELETE'})).status,404);
    }
    const duplicateGrants=await Promise.all([1,2].map(()=>call(alice,`/api/documents/${id}/permissions`,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({email:'charlie@test.invalid',permission:'READ'})})));
    assert.deepEqual(duplicateGrants.map(r=>r.status),[204,204]);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM document_permissions WHERE document_id=$1',[id])).rows[0].n,1);
    const beforeEdit=await call(charlie,`/api/documents/${id}/download`);
    assert.equal(beforeEdit.status,200);
    assert.equal(await beforeEdit.text(),'%PDF-test fixture');
    assert.equal((await call(charlie,`/api/documents/${id}`,{method:'DELETE'})).status,404);
    assert.equal((await call(charlie,`/api/documents/${id}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({name:'renamed.pdf',category:'private',ownerId:'forged'})})).status,404);
    assert.equal((await call(charlie,'/api/admin/activity')).status,403);
    const activity=await call(adminCookie,'/api/admin/activity'); assert.equal(activity.status,200);
    assert.ok((await activity.json()).events.some(event=>event.action==='DOCUMENT_UPLOAD' && event.document_id===id));
    assert.equal((await call(adminCookie,`/api/documents/${id}/download`)).status,404);
    assert.equal((await call(alice,`/api/documents/${id}/permissions`,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({email:'charlie@test.invalid',permission:'EDIT'})})).status,204);
    assert.equal((await call(charlie,`/api/documents/${id}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({name:'renamed.pdf',category:'private',ownerId:'forged',content:'attacker replacement'})})).status,204);
    assert.equal(await (await call(charlie,`/api/documents/${id}/download`)).text(),'%PDF-test fixture');
    assert.equal((await call(alice,`/api/documents/${id}/permissions`,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({email:'charlie@test.invalid',permission:'READ'})})).status,204);
    assert.equal((await call(charlie,`/api/documents/${id}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({name:'denied.pdf',category:'private'})})).status,404);
    assert.equal((await call(alice,`/api/documents/${id}/permissions`,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({email:'charlie@test.invalid',permission:'EDIT'})})).status,204);
    assert.equal((await db.query('SELECT owner_id FROM documents WHERE id=$1',[id])).rows[0].owner_id,(await db.query('SELECT id FROM users WHERE email=$1',['alice@test.invalid'])).rows[0].id);
    await db.query("CREATE FUNCTION reject_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test audit failure'; END $$");
    await db.query('CREATE TRIGGER reject_audit_trigger BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION reject_audit()');
    const rejectedWithoutAudit=new FormData();rejectedWithoutAudit.set('category','private');rejectedWithoutAudit.set('file',new Blob(['%PDF-test'],{type:'application/pdf'}),'forbidden.pdf');
    assert.equal((await call(charlie,'/api/documents',{method:'POST',body:rejectedWithoutAudit})).status,500,'failure to record a denied upload fails closed');
    const filesBefore=(await readdir(root)).sort();
    const failedUpload=new FormData();failedUpload.set('category','private');failedUpload.set('file',new Blob(['%PDF-failure'],{type:'application/pdf'}),'failure.pdf');
    assert.equal((await call(alice,'/api/documents',{method:'POST',body:failedUpload})).status,500);
    assert.deepEqual((await readdir(root)).sort(),filesBefore,'failed audited upload removes its local file');
    assert.equal((await db.query("SELECT count(*)::int AS n FROM documents WHERE name='failure.pdf'")).rows[0].n,0);
    assert.equal((await call(alice,`/api/documents/${id}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({name:'must-roll-back.pdf',category:'private'})})).status,500);
    assert.equal((await db.query('SELECT name FROM documents WHERE id=$1',[id])).rows[0].name,'renamed.pdf');
    await db.query('DROP TRIGGER reject_audit_trigger ON audit_events');
    const target=await db.query('SELECT id FROM users WHERE email=$1',['charlie@test.invalid']);
    const [revoke, concurrentDownload, concurrentEdit] = await Promise.all([
      call(alice,`/api/documents/${id}/permissions/${target.rows[0].id}`,{method:'DELETE'}),
      call(charlie,`/api/documents/${id}/download`),
      call(charlie,`/api/documents/${id}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({name:'race.pdf',category:'private'})})
    ]);
    assert.equal(revoke.status,204);
    assert.ok([200,404].includes(concurrentDownload.status),'in-flight download may finish or be denied');
    assert.ok([204,404].includes(concurrentEdit.status),'in-flight edit may finish or be denied');
    assert.equal((await call(charlie,`/api/documents/${id}/download`)).status,404);
    assert.equal((await call(charlie,`/api/documents/${id}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({name:'bad.pdf',category:'private'})})).status,404);
    assert.equal((await call(charlie,`/api/documents/${id}`,{method:'DELETE'})).status,404);
    assert.equal((await call(charlie,`/api/documents/${id}/permissions`)).status,404);
    assert.equal((await call(charlie,`/api/documents/${id}/permissions`,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({email:'bob@test.invalid',permission:'READ'})})).status,404);
    assert.equal((await call(charlie,`/api/documents/${id}/permissions/${viewerId}`,{method:'DELETE'})).status,404);
    assert.equal((await (await call(charlie,'/api/documents?name=renamed.pdf')).json()).documents.length,0);
    const simultaneousDeletes=await Promise.all([1,2].map(()=>call(alice,`/api/documents/${id}`,{method:'DELETE'})));
    assert.deepEqual(simultaneousDeletes.map(r=>r.status).sort(),[204,404]);
    assert.equal((await call(alice,`/api/documents/${id}/download`)).status,404);
    const denied=await db.query("SELECT count(*)::int AS n FROM audit_events WHERE document_id=$1 AND action='ACCESS_DENIED'",[id]);assert.ok(denied.rows[0].n>=4);
    const events = (await db.query('SELECT * FROM audit_events ORDER BY seq')).rows;
    const verified = verifyAuditChain(events); assert.equal(verified.valid,true,JSON.stringify(verified));
    const checkpoint = {hash:verified.hash,count:verified.count};
    const checkpointPath=join(root,'synthetic-checkpoint.json');
    await writeCheckpoint(checkpointPath,verified);
    assert.deepEqual(await readCheckpoint(checkpointPath),checkpoint);
    assert.equal(verifyAuditChain(events,checkpoint).valid,true);
    const earlier = verifyAuditChain(events.slice(0,-1));
    assert.equal(verifyAuditChain(events,{hash:earlier.hash,count:earlier.count}).valid,true);
    assert.equal(verifyAuditChain(events.map((e,i)=>i===1?{...e,action:'ALTERED'}:e)).valid,false);
    assert.equal(verifyAuditChain(events.map((e,i)=>i===1?{...e,actor_id:randomUUID()}:e)).valid,false);
    assert.equal(verifyAuditChain(events.map((e,i)=>i===1?{...e,previous_hash:'f'.repeat(64)}:e)).valid,false);
    assert.equal(verifyAuditChain(events.filter((_,i)=>i!==1)).valid,false);
    assert.equal(verifyAuditChain([events[1],events[0],...events.slice(2)]).valid,false);
    assert.equal(verifyAuditChain(events.slice(0,-1),checkpoint).valid,false);
    // Demonstrate the exact boundary: a database writer can rebuild a self-consistent
    // chain, but cannot make it match a previously protected checkpoint.
    let rewrittenHead='0'.repeat(64);
    const rewritten=events.map((event,index)=>{
      const changed={...event,action:index===1?'REWRITTEN':event.action,previous_hash:rewrittenHead};
      const payload=JSON.stringify([changed.event_id,changed.occurred_at.toISOString(),changed.actor_id,changed.actor_role,changed.action,changed.document_id,changed.result,changed.metadata]);
      changed.current_hash=createHash('sha256').update(rewrittenHead+payload).digest('hex');
      rewrittenHead=changed.current_hash;
      return changed;
    });
    assert.equal(verifyAuditChain(rewritten).valid,true);
    assert.equal(verifyAuditChain(rewritten,await readCheckpoint(checkpointPath)).valid,false);
    const initialPath=join(root,'operator-initial.json');
    const rotatedPath=join(root,'operator-rotated.json');
    const cliEnv={...process.env,DATABASE_URL:isolatedUrl.toString()};
    delete cliEnv.PREVIOUS_AUDIT_CHECKPOINT;
    await assert.rejects(run(process.execPath,['scripts/create-checkpoint.js',initialPath],{cwd:process.cwd(),env:cliEnv}));
    await run(process.execPath,['scripts/create-checkpoint.js','--initial',initialPath],{cwd:process.cwd(),env:cliEnv});
    await login('admin@test.invalid');
    await run(process.execPath,['scripts/create-checkpoint.js',rotatedPath],{cwd:process.cwd(),env:{...cliEnv,PREVIOUS_AUDIT_CHECKPOINT:initialPath}});
    assert.ok((await readCheckpoint(rotatedPath)).count > (await readCheckpoint(initialPath)).count);
    assert.equal((await call(bob,'/api/auth/logout',{method:'POST'})).status,204);
    assert.equal((await call(bob,'/api/auth/me')).status,401);
    await db.query('UPDATE users SET disabled=true WHERE id=$1',[target.rows[0].id]);
    const protectedRoutes=[['GET','/api/auth/me'],['GET','/api/documents'],['GET',`/api/documents/${id}/download`],['PATCH',`/api/documents/${id}`],['DELETE',`/api/documents/${id}`],['GET',`/api/documents/${id}/permissions`],['GET','/api/admin/activity']];
    for(const [method,path] of protectedRoutes) assert.equal((await call(charlie,path,{method,headers:{'content-type':'application/json'},...(method==='PATCH'?{body:'{}'}:{})})).status,401,`disabled ${method} ${path}`);
    await db.query('UPDATE users SET disabled=false WHERE id=$1',[target.rows[0].id]);
    await db.query("UPDATE sessions SET expires_at=now()-interval '1 second' WHERE user_id=$1",[target.rows[0].id]);
    for(const [method,path] of protectedRoutes) assert.equal((await call(charlie,path,{method,headers:{'content-type':'application/json'},...(method==='PATCH'?{body:'{}'}:{})})).status,401,`expired ${method} ${path}`);
  } finally { if(server) {server.kill('SIGTERM');await new Promise(resolve=>server.once('exit',resolve));} await db.end(); await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end(); await rm(root,{recursive:true,force:true}); }
});
