import { pool } from '../src/db.js';
import { checkAuditRole } from '../src/audit-role-check.js';
try {
  const result=await checkAuditRole(pool);
  console.log(JSON.stringify(result));
  if (!result.safe) process.exitCode=1;
} finally { await pool.end(); }
