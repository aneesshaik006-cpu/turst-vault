import { pool } from '../src/db.js';
import { verifyAuditChain } from '../src/audit-verify.js';
import { writeCheckpoint, readCheckpoint } from '../src/checkpoint.js';
const args = process.argv.slice(2);
const initial = args[0] === '--initial';
const destination = initial ? args[1] : args[0];
if (!destination || args.length !== (initial ? 2 : 1)) throw new Error('Usage: npm run audit:checkpoint -- [--initial] /operator-controlled/new-checkpoint.json');
if (initial === Boolean(process.env.PREVIOUS_AUDIT_CHECKPOINT)) throw new Error('Provide either --initial for an approved first baseline or PREVIOUS_AUDIT_CHECKPOINT for rotation');
try {
  const rows = (await pool.query('SELECT * FROM audit_events ORDER BY seq')).rows;
  // For subsequent checkpoints, require the previous independently protected
  // checkpoint so a rewrite cannot silently be accepted as a new baseline.
  const previous = process.env.PREVIOUS_AUDIT_CHECKPOINT ? await readCheckpoint(process.env.PREVIOUS_AUDIT_CHECKPOINT) : null;
  const result = verifyAuditChain(rows, previous);
  if (!result.valid) throw new Error(`Audit verification failed: ${result.reason}`);
  await writeCheckpoint(destination,result);
  console.log(`Checkpoint created for ${result.count} events; previous checkpoint verified: ${Boolean(previous)}`);
} finally { await pool.end(); }
