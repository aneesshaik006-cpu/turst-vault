import { createHash, randomUUID } from 'node:crypto';
import { pool } from './db.js';

// Serializing appends prevents two writers from producing the same predecessor.
export async function audit({ actor = null, action, documentId = null, result, metadata = {} }, transactionClient = null) {
  const client = transactionClient ?? await pool.connect();
  try {
    if (!transactionClient) await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [7218401]);
    const previous = await client.query('SELECT current_hash FROM audit_events ORDER BY seq DESC LIMIT 1');
    const previousHash = previous.rows[0]?.current_hash ?? '0'.repeat(64);
    const eventId = randomUUID();
    const occurredAt = new Date().toISOString();
    const payload = JSON.stringify([eventId, occurredAt, actor?.id ?? null, actor?.role ?? null, action, documentId, result, metadata]);
    const currentHash = createHash('sha256').update(previousHash + payload).digest('hex');
    await client.query('INSERT INTO audit_events(event_id,occurred_at,actor_id,actor_role,action,document_id,result,metadata,previous_hash,current_hash) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', [eventId, occurredAt, actor?.id ?? null, actor?.role ?? null, action, documentId, result, metadata, previousHash, currentHash]);
    if (!transactionClient) await client.query('COMMIT');
  } catch (error) { if (!transactionClient) await client.query('ROLLBACK'); throw error; }
  finally { if (!transactionClient) client.release(); }
}

// A security mutation and its audit event must commit or roll back together.
export async function auditedTransaction(work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
