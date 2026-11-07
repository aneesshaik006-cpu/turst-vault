import test from 'node:test';
import assert from 'node:assert/strict';
import { isSearchDate } from '../src/search-date.js';

test('search dates must be real calendar dates in ISO format', () => {
  for (const value of ['2024-02-29', '2026-01-01', '2026-12-31']) assert.equal(isSearchDate(value), true, value);
  for (const value of ['2025-02-29', '2026-02-30', '2026-13-01', '2026-00-01', '2026-1-01', 'not-a-date']) assert.equal(isSearchDate(value), false, value);
});
