import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';

test('Neon storage rejects incomplete or unsafe configuration at startup', () => {
  const base = { ...process.env, NODE_ENV: 'production', STORAGE_DRIVER: 'neon', AWS_ENDPOINT_URL_S3: 'https://storage.example.com', AWS_REGION: 'us-east-2', AWS_ACCESS_KEY_ID: 'test', AWS_SECRET_ACCESS_KEY: 'test', NEON_STORAGE_BUCKET: 'assets' };
  for (const changes of [
    { AWS_ENDPOINT_URL_S3: 'http://storage.example.com' },
    { AWS_ENDPOINT_URL_S3: 'https://user:password@storage.example.com' },
    { AWS_ENDPOINT_URL_S3: 'https://storage.example.com/path' },
    { AWS_REGION: '' },
    { AWS_ACCESS_KEY_ID: '' },
    { AWS_SECRET_ACCESS_KEY: '' },
    { NEON_STORAGE_BUCKET: '../invalid' },
  ]) {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', "await import('./src/storage.js')"], { env: { ...base, ...changes }, encoding: 'utf8' });
    assert.notEqual(result.status, 0, `configuration should fail: ${JSON.stringify(Object.keys(changes))}`);
  }
  const valid = spawnSync(process.execPath, ['--input-type=module', '-e', "await import('./src/storage.js')"], { env: base, encoding: 'utf8' });
  assert.equal(valid.status, 0, valid.stderr);
});
