import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID, createHash } from 'node:crypto';
import { readFile, writeFile, mkdtemp, rm, readdir, utimes } from 'node:fs/promises';
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
    async function login(email){const r=await fetch(origin+'/api/auth/login',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({email,password:'test-password-12345'})});assert.equal(r.status,200);const cookie=r.headers.get('set-cookie');assert.match(cookie,/HttpOnly/i);assert.match(cookie,/SameSite=Strict/i);return cookie.split(';')[0];}
    const alice=await login('alice@test.invalid'), bob=await login('bob@test.invalid'), charlie=await login('charlie@test.invalid'), adminCookie=await login('admin@test.invalid');
    const viewerId=(await db.query('SELECT id FROM users WHERE email=$1',['charlie@test.invalid'])).rows[0].id;
    const call=(cookie,path,opts={})=>fetch(origin+path,{...opts,headers:{origin,cookie,...opts.headers}});
    // Expiry is enforced server-side even if a client retains its cookie.
    const expiredCookie=await login('charlie@test.invalid');
    const expiredToken=expiredCookie.slice('trustvault_session='.length);
    await db.query("UPDATE sessions SET expires_at=now() - interval '1 second' WHERE token_hash=$1",[createHash('sha256').update(expiredToken).digest('hex')]);
    assert.equal((await call(expiredCookie,'/api/documents')).status,401);
    assert.equal((await call(charlie,'/api/documents')).status,200);
    const invalidLogin = email => fetch(origin+'/api/auth/login',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({email,password:'incorrect'})});
    const [wrong,missing]=await Promise.all([invalidLogin('alice@test.invalid'),invalidLogin('missing@test.invalid')]);
    assert.equal(wrong.status,401);assert.equal(missing.status,401);assert.deepEqual(await wrong.json(),await missing.json());
    assert.equal((await fetch(origin+'/api/documents')).status,401);
    assert.equal((await call('trustvault_session=forged','/api/documents')).status,401);
    assert.equal((await fetch(origin+'/api/auth/login',{method:'POST',headers:{origin:'https://attacker.invalid','content-type':'application/json'},body:JSON.stringify({email:'alice@test.invalid',password:'test-password-12345'})})).status,403);
    const rejectedReasons=(await db.query("SELECT metadata->>'reason' AS reason FROM audit_events WHERE action='REQUEST_REJECTED'")).rows.map(row=>row.reason);
    for (const reason of ['invalid_json','body_too_large','origin']) assert.ok(rejectedReasons.includes(reason),`audit ${reason}`);
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
    assert.equal((await call(alice,`/api/documents/${id}/permissions/not-a-uuid`,{method:'DELETE'})).status,404);
    assert.equal((await call(alice,`/api/documents/${id}/permissions/${randomUUID()}`,{method:'DELETE'})).status,404);
    const revokeFailures=await db.query("SELECT metadata FROM audit_events WHERE action='REQUEST_REJECTED' AND document_id=$1 AND metadata->>'reason' IN ('invalid_permission_target','permission_not_found') ORDER BY seq",[id]);
    assert.deepEqual(revokeFailures.rows.map(row=>row.metadata),[{reason:'invalid_permission_target'},{reason:'permission_not_found'}]);
    const anonymous=await fetch(`${origin}/api/documents/${id}/download`);
    assert.equal(anonymous.status,401);
    assert.equal((await call(bob,'/api/documents/not-a-uuid/download')).status,404);
    const deniedEvidence=await db.query("SELECT actor_id,document_id,metadata FROM audit_events WHERE action='ACCESS_DENIED' ORDER BY seq DESC LIMIT 2");
    assert.equal(deniedEvidence.rows[0].actor_id,(await db.query('SELECT id FROM users WHERE email=$1',['bob@test.invalid'])).rows[0].id);
    assert.equal(deniedEvidence.rows[0].document_id,null);
    assert.equal(deniedEvidence.rows[0].metadata.reason,'invalid_document_id');
    assert.equal(deniedEvidence.rows[1].actor_id,null);
    assert.equal(deniedEvidence.rows[1].document_id,id);
    assert.equal(deniedEvidence.rows[1].metadata.operation,'unauthenticated_document_request');
    // Exercise every object route with valid inputs: a 400 from validation must
    // not be mistaken for an authorization denial.
    const objectRoutes=[
      ['GET',`/api/documents/${id}/download`],
      ['PATCH',`/api/documents/${id}`,{name:'matrix.pdf',category:'matrix'}],
      ['DELETE',`/api/documents/${id}`],
      ['GET',`/api/documents/${id}/permissions`],
      ['PUT',`/api/documents/${id}/permissions`,{email:'bob@test.invalid',permission:'READ'}],
      ['DELETE',`/api/documents/${id}/permissions/${viewerId}`],
    ];
    async function checkObjectRoutes(cookie, expected, label) {
      for (const [index,[method,path,body]] of objectRoutes.entries()) {
        const response=await call(cookie,path,{method,...(body ? {headers:{'content-type':'application/json'},body:JSON.stringify(body)} : {})});
        assert.equal(response.status,expected[index],`${label}: ${method} ${path}`);
      }
    }
    for (const [label,cookie] of [['unrelated owner',bob],['unrelated viewer',charlie],['ungranted admin',adminCookie]]) {
      await checkObjectRoutes(cookie,[404,404,404,404,404,404],label);
      assert.equal((await (await call(cookie,'/api/documents?name=secret.pdf')).json()).documents.length,0,`${label} cannot search hidden document`);
    }
    const bobForm=new FormData();bobForm.set('category','bob-private');bobForm.set('file',new Blob(['%PDF-bob-private'],{type:'application/pdf'}),'bob-private.pdf');
    const bobUpload=await call(bob,'/api/documents',{method:'POST',body:bobForm});assert.equal(bobUpload.status,201);const bobId=(await bobUpload.json()).id;
    const aliceDenied=await call(alice,`/api/documents/${bobId}/download`);
    assert.equal(aliceDenied.status,404);assert.doesNotMatch(await aliceDenied.text(),/bob-private/);
    assert.equal((await call(alice,`/api/documents/${bobId}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({name:'stolen.pdf',category:'private'})})).status,404);
    assert.equal((await call(alice,`/api/documents/${bobId}`,{method:'DELETE'})).status,404);
    assert.equal((await call(alice,`/api/documents/${bobId}/permissions`)).status,404);
    assert.equal((await (await call(alice,'/api/documents?name=bob-private.pdf')).json()).documents.length,0);
    const storedKey=(await db.query('SELECT storage_key FROM documents WHERE id=$1',[id])).rows[0].storage_key;
    assert.equal((await fetch(`${origin}/.local/documents/${storedKey}`)).status,404);
    await writeFile(join(root,storedKey),'%PDF-test fixturE');
    assert.equal((await call(alice,`/api/documents/${id}/download`)).status,500,'corrupted content is not delivered');
    assert.equal((await db.query("SELECT count(*)::int AS n FROM audit_events WHERE document_id=$1 AND action='DOCUMENT_DOWNLOAD' AND result='failure'",[id])).rows[0].n,1);
    await writeFile(join(root,storedKey),'%PDF-test fixture');
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
    await checkObjectRoutes(charlie,[200,404,404,404,404,404],'READ grant');
    assert.equal((await (await call(charlie,'/api/documents?name=secret.pdf')).json()).documents.length,1);
    assert.equal((await call(alice,`/api/documents/${id}/permissions`)).status,200);
    for(const body of [{email:'alice@test.invalid',permission:'READ'},{email:'missing@test.invalid',permission:'READ'},{email:'charlie@test.invalid',permission:'ADMIN'}]) assert.equal((await call(alice,`/api/documents/${id}/permissions`,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(body)})).status,400);
    assert.equal((await call(alice,'/api/documents?from=not-a-date')).status,400);
    assert.equal((await call(alice,'/api/documents?from=2025-02-29')).status,400);
    assert.equal((await call(alice,'/api/documents?from=2026-12-01&to=2026-01-01')).status,400);
    assert.equal((await call(alice,'/api/documents?from=2024-02-29&to=2026-12-31')).status,200);
    assert.equal((await call(alice,`/api/documents/${id}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({name:'',category:'private'})})).status,400);
    const rejectionReasons=(await db.query("SELECT metadata->>'reason' AS reason FROM audit_events WHERE action='REQUEST_REJECTED'")).rows.map(row=>row.reason);
    for(const reason of ['invalid_permission','invalid_recipient','invalid_search_date','invalid_document_details']) assert.ok(rejectionReasons.includes(reason),`${reason} is audited`);
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
    await checkObjectRoutes(charlie,[200,204,404,404,404,404],'EDIT grant');
    assert.equal((await call(charlie,`/api/documents/${id}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({name:'renamed.pdf',category:'private',ownerId:'forged',content:'attacker replacement'})})).status,204);
    assert.equal(await (await call(charlie,`/api/documents/${id}/download`)).text(),'%PDF-test fixture');
    assert.equal((await call(alice,`/api/documents/${id}/permissions`,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({email:'charlie@test.invalid',permission:'READ'})})).status,204);
    assert.equal((await call(charlie,`/api/documents/${id}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({name:'denied.pdf',category:'private'})})).status,404);
    assert.equal((await call(alice,`/api/documents/${id}/permissions`,{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({email:'charlie@test.invalid',permission:'EDIT'})})).status,204);
    assert.equal((await db.query('SELECT owner_id FROM documents WHERE id=$1',[id])).rows[0].owner_id,(await db.query('SELECT id FROM users WHERE email=$1',['alice@test.invalid'])).rows[0].id);
    await db.query("CREATE FUNCTION reject_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test audit failure'; END $$");
    await db.query('CREATE TRIGGER reject_audit_trigger BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION reject_audit()');
    assert.equal((await fetch(origin+'/api/auth/login',{method:'POST',headers:{origin:'https://attacker.invalid','content-type':'application/json'},body:'{}'})).status,500,'origin rejection fails closed when audit is unavailable');
    assert.equal((await fetch(origin+'/api/auth/login',{method:'POST',headers:{origin,'content-type':'application/json'},body:'{'})).status,500,'parser rejection fails closed when audit is unavailable');
    assert.equal((await call(alice,`/api/documents/${id}/download`)).status,500,'download fails closed if the access event cannot be recorded');
    assert.equal((await fetch(`${origin}/api/documents/${id}/download`)).status,500,'unauthenticated access fails closed if denial cannot be recorded');
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
    // A database insert failure after storage succeeds must remove the object
    // and record the failure without committing a document.
    await db.query("CREATE FUNCTION reject_document() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test document failure'; END $$");
    await db.query('CREATE TRIGGER reject_document_trigger BEFORE INSERT ON documents FOR EACH ROW EXECUTE FUNCTION reject_document()');
    const beforeInsertFailure=(await readdir(root)).sort();
    const rejectedInsert=new FormData(); rejectedInsert.set('category','private'); rejectedInsert.set('file',new Blob(['%PDF-rollback'],{type:'application/pdf'}),'rollback.pdf');
    assert.equal((await call(alice,'/api/documents',{method:'POST',body:rejectedInsert})).status,500);
    assert.deepEqual((await readdir(root)).sort(),beforeInsertFailure,'database failure removes stored local object');
    assert.equal((await db.query("SELECT count(*)::int AS n FROM documents WHERE name='rollback.pdf'")).rows[0].n,0);
    const rollbackEvent=await db.query("SELECT result,metadata FROM audit_events WHERE action='DOCUMENT_UPLOAD' ORDER BY seq DESC LIMIT 1");
    assert.deepEqual(rollbackEvent.rows[0],{result:'failure',metadata:{reason:'transaction'}});
    await db.query('DROP TRIGGER reject_document_trigger ON documents');
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
    // The revoke response is a commit barrier. Reuse the same session and URL
    // concurrently after it returns, and verify no rejected edit persisted.
    const nameAfterRevoke=(await db.query('SELECT name FROM documents WHERE id=$1',[id])).rows[0].name;
    const afterRevoke=await Promise.all(Array.from({length:5},async (_,index)=>{
      const [download,edit,listing]=await Promise.all([
        call(charlie,`/api/documents/${id}/download`),
        call(charlie,`/api/documents/${id}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({name:`revoked-${index}.pdf`,category:'private'})}),
        call(charlie,`/api/documents?name=${encodeURIComponent(nameAfterRevoke)}`),
      ]);
      return {download:download.status,edit:edit.status,documents:(await listing.json()).documents};
    }));
    for(const result of afterRevoke) {
      assert.equal(result.download,404,'old download URL is denied after revoke completes');
      assert.equal(result.edit,404,'an already-open editor cannot save after revoke completes');
      assert.equal(result.documents.length,0,'post-revoke search hides the document');
    }
    assert.equal((await db.query('SELECT name FROM documents WHERE id=$1',[id])).rows[0].name,nameAfterRevoke,'post-revocation edits did not persist');
    assert.equal((await call(charlie,'/api/auth/me')).status,200,'revocation does not require logout');
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
    const healthEnv={...cliEnv,AUDIT_CHECKPOINT_FILE:rotatedPath};
    const health=await run(process.execPath,['scripts/check-audit-health.js'],{cwd:process.cwd(),env:healthEnv});
    const capacityEnv={...cliEnv,AUDIT_MAX_BYTES:String(Number.MAX_SAFE_INTEGER)};
    const capacity=JSON.parse((await run(process.execPath,['scripts/check-audit-capacity.js'],{cwd:process.cwd(),env:capacityEnv})).stdout);
    assert.equal(capacity.healthy,true);
    assert.ok(capacity.sizeBytes>0);
    await assert.rejects(run(process.execPath,['scripts/check-audit-capacity.js'],{cwd:process.cwd(),env:{...capacityEnv,AUDIT_MAX_BYTES:String(capacity.sizeBytes)}}),error=>JSON.parse(error.stdout).healthy===false);
    await assert.rejects(run(process.execPath,['scripts/check-audit-capacity.js'],{cwd:process.cwd(),env:{...capacityEnv,AUDIT_MAX_BYTES:'invalid'}}),error=>JSON.parse(error.stderr).healthy===false);
    assert.equal(JSON.parse(health.stdout).healthy,true);
    const staleCheckpoint=join(root,'stale-checkpoint.json');
    await writeFile(staleCheckpoint,await readFile(rotatedPath));
    const oldTime=new Date(Date.now()-72*60*60*1000);
    await utimes(staleCheckpoint,oldTime,oldTime);
    await assert.rejects(run(process.execPath,['scripts/check-audit-health.js'],{cwd:process.cwd(),env:{...healthEnv,AUDIT_CHECKPOINT_FILE:staleCheckpoint}}),error=>JSON.parse(error.stdout).checkpointFresh===false);
    const invalidCheckpoint=join(root,'invalid-checkpoint.json');
    await writeFile(invalidCheckpoint,JSON.stringify({version:1,count:0,hash:'f'.repeat(64)}));
    await assert.rejects(run(process.execPath,['scripts/check-audit-health.js'],{cwd:process.cwd(),env:{...healthEnv,AUDIT_CHECKPOINT_FILE:invalidCheckpoint}}));
    assert.equal((await call(bob,'/api/auth/logout',{method:'POST'})).status,204);
    assert.equal((await call(bob,'/api/auth/me')).status,401);
    await db.query('UPDATE users SET disabled=true WHERE id=$1',[target.rows[0].id]);
    const protectedRoutes=[['GET','/api/auth/me'],['POST','/api/auth/logout'],['GET','/api/documents'],['POST','/api/documents'],...objectRoutes,['GET','/api/admin/activity']];
    for(const [method,path] of protectedRoutes) {
      for(const [label,cookie] of [['missing',''],['forged','trustvault_session=forged']]) {
        assert.equal((await call(cookie,path,{method,headers:{'content-type':'application/json'},...(['PATCH','PUT'].includes(method)?{body:'{}'}:{})})).status,401,`${label} ${method} ${path}`);
      }
    }
    for(const [method,path] of protectedRoutes) assert.equal((await call(charlie,path,{method,headers:{'content-type':'application/json'},...(['PATCH','PUT'].includes(method)?{body:'{}'}:{})})).status,401,`disabled ${method} ${path}`);
    await db.query('UPDATE users SET disabled=false WHERE id=$1',[target.rows[0].id]);
    await db.query("UPDATE sessions SET expires_at=now()-interval '1 second' WHERE user_id=$1",[target.rows[0].id]);
    for(const [method,path] of protectedRoutes) assert.equal((await call(charlie,path,{method,headers:{'content-type':'application/json'},...(['PATCH','PUT'].includes(method)?{body:'{}'}:{})})).status,401,`expired ${method} ${path}`);
  } finally { if(server) {server.kill('SIGTERM');await new Promise(resolve=>server.once('exit',resolve));} await db.end(); await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end(); await rm(root,{recursive:true,force:true}); }
});
