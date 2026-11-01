import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import pg from 'pg';
const run=promisify(execFile);
const url=process.env.TEST_DATABASE_URL;
test('migrations run from an empty schema and can be rerun', {skip:!url?'Set TEST_DATABASE_URL to a disposable PostgreSQL database':false}, async()=>{
  const schema='test_'+randomUUID().replaceAll('-','');
  const admin=new pg.Pool({connectionString:url}); await admin.query(`CREATE SCHEMA ${schema}`);
  const isolated=new URL(url); isolated.searchParams.set('options',`-c search_path=${schema}`);
  const db=new pg.Pool({connectionString:isolated.toString()});
  try {
    for(let i=0;i<2;i++) {
      const result=await run(process.execPath,['scripts/migrate.js'],{cwd:process.cwd(),env:{...process.env,DATABASE_URL:isolated.toString()}});
      assert.match(result.stdout,/Migrations applied/);
    }
    const result=await db.query('SELECT name FROM schema_migrations ORDER BY name');
    assert.deepEqual(result.rows.map(row=>row.name),['001_initial.sql','002_login_throttle.sql']);
    assert.equal((await db.query("SELECT to_regclass('login_throttles') IS NOT NULL AS present")).rows[0].present,true);
  } finally {await db.end();await admin.query(`DROP SCHEMA ${schema} CASCADE`);await admin.end();}
});
