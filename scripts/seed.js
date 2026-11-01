import { randomUUID } from 'node:crypto';
import { pool } from '../src/db.js';
import { hashPassword } from '../src/auth-crypto.js';

if (process.env.NODE_ENV === 'production') throw new Error('Demo seed is disabled in production');
const password = process.env.DEMO_PASSWORD;
if (!password) throw new Error('Set DEMO_PASSWORD to a unique demo-only password');
try {
  for (const [email, role] of [['admin@trustvault.demo','ADMIN'], ['owner@trustvault.demo','OWNER'], ['bob@trustvault.demo','OWNER'], ['viewer@trustvault.demo','VIEWER'], ['dave@trustvault.demo','VIEWER']]) {
    const hash = await hashPassword(password);
    await pool.query('INSERT INTO users(id,email,password_hash,role) VALUES($1,$2,$3,$4) ON CONFLICT(email) DO NOTHING', [randomUUID(), email, hash, role]);
  }
  console.log('Demo users seeded; existing users were not modified');
} finally { await pool.end(); }
