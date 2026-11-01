// Local synthetic fixture helper. State contains a temporary test-only cookie;
// keep it private and remove it after the fixture is stopped.
import { writeFile, readFile, unlink } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
const [operation,path] = process.argv.slice(2);
if (!['setup','revoke'].includes(operation) || !path || !isAbsolute(path)) throw new Error('Usage: node scripts/browser-revocation-control.js setup|revoke /absolute/path/to/temporary-state.json');
const origin='http://127.0.0.1:4193';
if (operation==='setup') {
  const login=await fetch(origin+'/api/auth/login',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({email:'browser-owner@test.invalid',password:'Local-test-password-2026'})});
  if(!login.ok) throw new Error(`Synthetic owner login failed: ${login.status}`);
  const cookie=login.headers.get('set-cookie').split(';')[0];
  const form=new FormData();form.set('category','Synthetic');form.set('file',new Blob(['%PDF-synthetic'],{type:'application/pdf'}),'revocation-test.pdf');
  const upload=await fetch(origin+'/api/documents',{method:'POST',headers:{origin,cookie},body:form});
  if(!upload.ok) throw new Error(`Synthetic upload failed: ${upload.status}`);
  const {id}=await upload.json();
  const grant=await fetch(`${origin}/api/documents/${id}/permissions`,{method:'PUT',headers:{origin,cookie,'content-type':'application/json'},body:JSON.stringify({email:'browser-viewer@test.invalid',permission:'READ'})});
  if(!grant.ok) throw new Error(`Synthetic grant failed: ${grant.status}`);
  const list=await fetch(`${origin}/api/documents/${id}/permissions`,{headers:{cookie}});
  if(!list.ok) throw new Error(`Permission list failed: ${list.status}`);
  const {permissions}=await list.json();
  const target=permissions.find(p=>p.email==='browser-viewer@test.invalid');
  if(!target) throw new Error('Synthetic viewer grant missing');
  await writeFile(path,JSON.stringify({id,cookie,userId:target.user_id}),{flag:'wx',mode:0o600});
  console.log(`Synthetic READ grant created; previous download route: /api/documents/${id}/download`);
} else {
  const {id,cookie,userId}=JSON.parse(await readFile(path,'utf8'));
  const result=await fetch(`${origin}/api/documents/${id}/permissions/${userId}`,{method:'DELETE',headers:{origin,cookie}});
  if(result.status!==204) throw new Error(`Synthetic revocation failed: ${result.status}`);
  await unlink(path);
  console.log('Synthetic READ grant revoked; temporary state removed');
}
