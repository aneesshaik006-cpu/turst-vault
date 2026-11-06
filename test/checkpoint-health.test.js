import test from 'node:test';
import assert from 'node:assert/strict';
import { checkpointIsFresh } from '../src/checkpoint-health.js';

test('checkpoint health rejects stale, future and invalid timestamps', () => {
  const now = new Date('2026-01-03T00:00:00Z');
  assert.equal(checkpointIsFresh(new Date('2026-01-02T00:00:00Z'),now,48),true);
  assert.equal(checkpointIsFresh(new Date('2025-12-31T00:00:00Z'),now,48),false);
  assert.equal(checkpointIsFresh(new Date('2026-01-04T00:00:00Z'),now,48),false);
  assert.throws(()=>checkpointIsFresh(new Date('bad'),now,48),/Invalid checkpoint timestamp/);
  assert.throws(()=>checkpointIsFresh(now,now,0),/Invalid checkpoint maximum age/);
});
