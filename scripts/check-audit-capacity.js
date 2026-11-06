import { pool } from '../src/db.js';
import { assessAuditCapacity } from '../src/audit-capacity.js';

try {
  const configuredLimit = process.env.AUDIT_MAX_BYTES;
  if (!configuredLimit || !/^[1-9]\d*$/.test(configuredLimit)) throw new Error('AUDIT_MAX_BYTES must be a positive integer');
  const result = await pool.query("SELECT pg_total_relation_size('audit_events'::regclass)::text AS size_bytes");
  const assessment = assessAuditCapacity(Number(result.rows[0].size_bytes), Number(configuredLimit));
  console.log(JSON.stringify(assessment));
  if (!assessment.healthy) process.exitCode = 1;
} catch (error) {
  console.error(JSON.stringify({ healthy: false, error: error.message }));
  process.exitCode = 1;
} finally {
  await pool.end();
}
