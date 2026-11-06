import { list } from '@vercel/blob';
import { pool } from '../src/db.js';
import { compareStorageInventory } from '../src/storage-reconcile.js';

if (process.env.STORAGE_DRIVER !== 'vercel-blob' || !process.env.BLOB_READ_WRITE_TOKEN) throw new Error('Use a designated private Blob store and set STORAGE_DRIVER=vercel-blob');
const hours = Number(process.env.RECONCILE_GRACE_HOURS ?? 24);
if (!Number.isFinite(hours) || hours < 24 || hours > 24 * 365) throw new Error('RECONCILE_GRACE_HOURS must be between 24 and 8760');
const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
try {
  const blobs = [], cursors = new Set();
  let cursor;
  do {
    const page = await list({cursor,limit:1000});
    blobs.push(...page.blobs);
    if (!page.hasMore) break;
    if (!page.cursor || cursors.has(page.cursor)) throw new Error('Blob pagination did not advance');
    cursors.add(page.cursor); cursor = page.cursor;
  } while (true);
  // Include soft-deleted documents: their storage may intentionally be retained.
  const documents = (await pool.query('SELECT storage_key,created_at FROM documents')).rows;
  const comparison = compareStorageInventory(documents,blobs,cutoff);
  console.log(JSON.stringify({cutoff:cutoff.toISOString(),documentCount:documents.length,blobCount:blobs.length,...comparison},null,2));
  if (comparison.candidateOrphans.length || comparison.missingObjects.length || comparison.unrecognizedObjects.length) process.exitCode = 2;
} finally { await pool.end(); }
