import test from 'node:test';
import assert from 'node:assert/strict';
import { canAccessDocument } from '../src/authorization.js';

const alice = { id: 'alice', disabled: false };
const bob = { id: 'bob', disabled: false };
const admin = { id: 'admin', disabled: false, role: 'ADMIN' };
const document = { id: 'doc-a', ownerId: 'alice', deleted: false };
const access = (user, operation, grant, doc = document) => canAccessDocument({ user, operation, grant, document: doc });

test('owner may perform supported operations', () => {
  for (const operation of ['read', 'edit', 'delete', 'managePermissions']) assert.equal(access(alice, operation), true);
});
test('unrelated users and admins cannot access or manage a document', () => {
  for (const user of [bob, admin]) for (const operation of ['read', 'edit', 'delete', 'managePermissions']) assert.equal(access(user, operation), false);
});
test('READ and EDIT grant only their intended capabilities', () => {
  const grant = { userId: 'bob', documentId: 'doc-a', permission: 'READ' };
  assert.equal(access(bob, 'read', grant), true);
  for (const operation of ['edit', 'delete', 'managePermissions']) assert.equal(access(bob, operation, grant), false);
  grant.permission = 'EDIT';
  assert.equal(access(bob, 'read', grant), true);
  assert.equal(access(bob, 'edit', grant), true);
  assert.equal(access(bob, 'delete', grant), false);
  assert.equal(access(bob, 'managePermissions', grant), false);
});
test('mismatched, malformed, or revoked grants deny access', () => {
  for (const grant of [undefined, { userId: 'alice', documentId: 'doc-a', permission: 'READ' }, { userId: 'bob', documentId: 'other', permission: 'EDIT' }, { userId: 'bob', documentId: 'doc-a', permission: 'ADMIN' }]) assert.equal(access(bob, 'read', grant), false);
});
test('deleted documents, disabled users and unknown actions deny access', () => {
  assert.equal(access(alice, 'read', undefined, { ...document, deleted: true }), false);
  assert.equal(access({ ...alice, disabled: true }, 'read'), false);
  assert.equal(access(alice, 'unknown'), false);
  assert.equal(access(null, 'read'), false);
});
