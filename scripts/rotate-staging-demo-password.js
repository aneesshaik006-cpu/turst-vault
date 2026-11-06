import { hashPassword } from '../src/auth-crypto.js';
import { pool } from '../src/db.js';
import { audit, auditedTransaction } from '../src/audit.js';

const addresses=['admin@trustvault.demo','owner@trustvault.demo','bob@trustvault.demo','viewer@trustvault.demo','dave@trustvault.demo'];
try {
  if (process.env.NODE_ENV === 'production' || process.env.CONFIRM_STAGING_DEMO_RESET !== 'staging-only') throw new Error('This command requires explicit staging-only confirmation and cannot run in production mode');
  const password=process.env.DEMO_PASSWORD;
  if (typeof password !== 'string' || Buffer.byteLength(password,'utf8') < 16) throw new Error('Set a unique staging-only DEMO_PASSWORD of at least 16 bytes');
  const hashes=await Promise.all(addresses.map(async address=>[address,await hashPassword(password)]));
  const result=await auditedTransaction(async client=>{
    const users=await client.query('SELECT id,email FROM users WHERE email=ANY($1::text[]) FOR UPDATE',[addresses]);
    if (users.rowCount !== addresses.length) throw new Error('Expected staging demo accounts were not all found; no changes made');
    const ids=users.rows.map(user=>user.id);
    for (const [address,hash] of hashes) await client.query('UPDATE users SET password_hash=$1 WHERE email=$2',[hash,address]);
    await client.query('DELETE FROM sessions WHERE user_id=ANY($1::uuid[])',[ids]);
    await audit({action:'STAGING_DEMO_CREDENTIALS_ROTATED',result:'success',metadata:{count:ids.length}},client);
    return ids.length;
  });
  console.log(`Rotated ${result} staging demo accounts and invalidated their sessions`);
} finally { await pool.end(); }
