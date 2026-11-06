import test from 'node:test';
import assert from 'node:assert/strict';
import { compareStorageInventory } from '../src/storage-reconcile.js';

test('inventory comparison retains referenced and recent objects and identifies discrepancies', () => {
  const keys = ['00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000004'];
  const old = new Date('2026-01-01T00:00:00Z'), recent = new Date('2026-01-03T00:00:00Z'), cutoff = new Date('2026-01-02T00:00:00Z');
  const result = compareStorageInventory([{storage_key:keys[0],created_at:old},{storage_key:keys[1],created_at:old}], [{pathname:keys[0],uploadedAt:old},{pathname:keys[2],uploadedAt:old},{pathname:keys[3],uploadedAt:recent},{pathname:'other/object',uploadedAt:old}],cutoff);
  assert.deepEqual(result,{candidateOrphans:[keys[2]],missingObjects:[keys[1]],unrecognizedObjects:['other/object']});
  assert.throws(()=>compareStorageInventory([{storage_key:'../bad',created_at:old}],[],cutoff),/Invalid database storage key/);
  assert.throws(()=>compareStorageInventory([],[{pathname:keys[0],uploadedAt:'bad'}],cutoff),/Invalid Blob timestamp/);
});
