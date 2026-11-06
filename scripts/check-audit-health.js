import { stat } from 'node:fs/promises';
import { pool } from '../src/db.js';
import { readCheckpoint } from '../src/checkpoint.js';
import { verifyAuditChain } from '../src/audit-verify.js';
import { checkpointIsFresh } from '../src/checkpoint-health.js';

try {
  const path = process.env.AUDIT_CHECKPOINT_FILE;
  if (!path) throw new Error('AUDIT_CHECKPOINT_FILE is required');
  const maxAge = Number(process.env.AUDIT_CHECKPOINT_MAX_AGE_HOURS ?? 48);
  const checkpoint = await readCheckpoint(path);
  const fresh = checkpointIsFresh((await stat(path)).mtime,new Date(),maxAge);
  const events = (await pool.query('SELECT * FROM audit_events ORDER BY seq')).rows;
  const result = verifyAuditChain(events,checkpoint);
  console.log(JSON.stringify({healthy:result.valid && fresh,checkpointFresh:fresh,chainValid:result.valid,reason:result.valid ? undefined : result.reason,eventCount:events.length}));
  if (!result.valid || !fresh) process.exitCode = 1;
} catch (error) {
  console.error(JSON.stringify({healthy:false,error:error.message}));
  process.exitCode = 1;
} finally { await pool.end(); }
