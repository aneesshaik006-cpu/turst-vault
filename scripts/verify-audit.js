import { pool } from '../src/db.js';
import { verifyAuditChain } from '../src/audit-verify.js';
import { readCheckpoint } from '../src/checkpoint.js';
try {
  const events = await pool.query('SELECT * FROM audit_events ORDER BY seq');
  const expected = process.env.AUDIT_CHECKPOINT_HASH;
  const count = process.env.AUDIT_CHECKPOINT_COUNT;
  if ((expected && !count) || (!expected && count) || (count && !/^\d+$/.test(count))) throw new Error('Supply both valid AUDIT_CHECKPOINT_HASH and AUDIT_CHECKPOINT_COUNT');
  if (process.env.AUDIT_CHECKPOINT_FILE && expected) throw new Error('Use either a checkpoint file or checkpoint environment variables');
  const checkpoint = process.env.AUDIT_CHECKPOINT_FILE ? await readCheckpoint(process.env.AUDIT_CHECKPOINT_FILE) : expected ? {hash:expected,count:Number(count)} : null;
  const result = verifyAuditChain(events.rows, checkpoint);
  console.log(JSON.stringify(result));
  if (!result.valid) process.exitCode = 1;
} finally { await pool.end(); }
