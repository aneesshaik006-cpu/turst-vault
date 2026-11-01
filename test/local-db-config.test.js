import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('local database requires explicit password and refuses production', () => {
  const env={...process.env,NODE_ENV:'development'};delete env.LOCAL_DB_PASSWORD;
  const missing=spawnSync(process.execPath,['scripts/local-db.js'],{env,encoding:'utf8'});
  assert.notEqual(missing.status,0);
  assert.match(missing.stderr,/LOCAL_DB_PASSWORD/);
  const production=spawnSync(process.execPath,['scripts/local-db.js'],{env:{...env,NODE_ENV:'production'},encoding:'utf8'});
  assert.notEqual(production.status,0);
  assert.match(production.stderr,/cannot run in production/);
});
