// Local-only disposable browser test fixture. Never use a production database.
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import pg from 'pg';
import { hashPassword } from '../src/auth-crypto.js';
if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL is required');
const schema='test_'+randomUUID().replaceAll('-','');
const admin=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL});
await admin.query(`CREATE SCHEMA ${schema}`);
const isolated=new URL(process.env.TEST_DATABASE_URL); isolated.searchParams.set('options',`-c search_path=${schema}`);
const db=new pg.Pool({connectionString:isolated.toString()});
const storage=await mkdtemp(join(tmpdir(),'trustvault-browser-'));
let child;
let stopping=false;
async function cleanup() {
  stopping=true;
  if (child && child.exitCode === null) { child.kill('SIGTERM'); await new Promise(resolve=>child.once('exit',resolve)); }
  await db.end(); await admin.query(`DROP SCHEMA ${schema} CASCADE`); await admin.end(); await rm(storage,{recursive:true,force:true});
}
try {
  for(const file of ['001_initial.sql','002_login_throttle.sql']) await db.query(await readFile(new URL(`../migrations/${file}`,import.meta.url),'utf8'));
  const password=await hashPassword('Local-test-password-2026');
  for(const [email,role] of [['browser-owner@test.invalid','OWNER'],['browser-viewer@test.invalid','VIEWER'],['browser-admin@test.invalid','ADMIN']]) await db.query('INSERT INTO users(id,email,password_hash,role) VALUES($1,$2,$3,$4)',[randomUUID(),email,password,role]);
  child=spawn(process.execPath,['src/server.js'],{env:{...process.env,DATABASE_URL:isolated.toString(),APP_ORIGIN:'http://127.0.0.1:4193',PORT:'4193',STORAGE_DIR:storage},stdio:'inherit'});
  child.on('exit',()=>{ if (!stopping) process.kill(process.pid,'SIGTERM'); });
  for(const signal of ['SIGINT','SIGTERM']) process.once(signal,async()=>{await cleanup();process.exit(0);});
} catch(e) { await cleanup(); throw e; }
