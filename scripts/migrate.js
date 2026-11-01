import { readFile } from 'node:fs/promises';
import { pool } from '../src/db.js';
const client = await pool.connect();
try {
  await client.query('BEGIN');
  await client.query('SELECT pg_advisory_xact_lock($1)', [7218402]);
  await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())');
  for (const name of ['001_initial.sql', '002_login_throttle.sql']) {
    const result = await client.query('SELECT 1 FROM schema_migrations WHERE name=$1', [name]);
    if (!result.rowCount) {
      await client.query(await readFile(new URL('../migrations/' + name, import.meta.url), 'utf8'));
      await client.query('INSERT INTO schema_migrations(name) VALUES($1)', [name]);
    }
  }
  await client.query('COMMIT');
  console.log('Migrations applied');
} catch (err) { await client.query('ROLLBACK'); throw err; }
finally { client.release(); await pool.end(); }
