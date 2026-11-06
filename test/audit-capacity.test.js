import test from 'node:test';
import assert from 'node:assert/strict';
import { assessAuditCapacity } from '../src/audit-capacity.js';

test('audit capacity fails at the configured threshold and rejects invalid values', () => {
  assert.equal(assessAuditCapacity(99, 100).healthy, true);
  assert.equal(assessAuditCapacity(100, 100).healthy, false);
  assert.equal(assessAuditCapacity(101, 100).healthy, false);
  for (const value of [-1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => assessAuditCapacity(value, 100));
    assert.throws(() => assessAuditCapacity(1, value));
  }
  assert.throws(() => assessAuditCapacity(1, 0));
});
