import { pool } from '../src/db.js';
import { checkAuditRole, inspectAuditEscalation } from '../src/audit-role-check.js';

try {
  const client=await pool.connect();
  try {
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const diagnostic=await checkAuditRole(client);
    const inventory=await inspectAuditEscalation(client);
    await client.query('COMMIT');
    console.log(JSON.stringify({diagnostic,inventory},null,2));
    if (!diagnostic.safe) process.exitCode=1;
  } catch(error) {await client.query('ROLLBACK');throw error;}
  finally {client.release();}
} finally {await pool.end();}
