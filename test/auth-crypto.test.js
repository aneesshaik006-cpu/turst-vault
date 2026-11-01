import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, createSessionToken, hashSessionToken } from '../src/auth-crypto.js';

test('password hashes use unique salts and verify correctly', async () => {
  const password = 'a sufficiently long password';
  const one = await hashPassword(password);
  const two = await hashPassword(password);
  assert.notEqual(one, two);
  assert.equal(await verifyPassword(password, one), true);
  assert.equal(await verifyPassword('incorrect password', one), false);
  assert.equal(await verifyPassword(password, null), false);
  assert.equal(await verifyPassword(password, 'scrypt$1$1$1$bad$bad'), false);
});
test('password creation rejects invalid input', async () => {
  await assert.rejects(hashPassword('short'));
  await assert.rejects(hashPassword('x'.repeat(1025)));
});
test('session tokens are random, stored as hashes and reject malformed input', () => {
  const a = createSessionToken();
  const b = createSessionToken();
  assert.notEqual(a.token, b.token);
  assert.notEqual(a.token, a.tokenHash);
  assert.equal(hashSessionToken(a.token), a.tokenHash);
  assert.equal(hashSessionToken('invalid'), null);
});
