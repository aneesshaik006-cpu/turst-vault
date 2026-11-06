const storageKey = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// This comparison is advisory: the database and Blob listings are not one
// atomic snapshot, and no result authorizes deleting an object.
export function compareStorageInventory(documents, blobs, cutoff) {
  if (!(cutoff instanceof Date) || !Number.isFinite(cutoff.valueOf())) throw new Error('Invalid inventory cutoff');
  const referenced = new Set();
  for (const document of documents) {
    if (!storageKey.test(document.storage_key)) throw new Error('Invalid database storage key');
    const created = new Date(document.created_at);
    if (!Number.isFinite(created.valueOf())) throw new Error('Invalid document timestamp');
    referenced.add(document.storage_key);
  }
  const present = new Set(), candidates = [], unknownObjects = [];
  for (const blob of blobs) {
    if (typeof blob.pathname !== 'string') throw new Error('Invalid Blob pathname');
    const uploaded = new Date(blob.uploadedAt);
    if (!Number.isFinite(uploaded.valueOf())) throw new Error('Invalid Blob timestamp');
    if (!storageKey.test(blob.pathname)) { unknownObjects.push(blob.pathname); continue; }
    present.add(blob.pathname);
    if (!referenced.has(blob.pathname) && uploaded < cutoff) candidates.push(blob.pathname);
  }
  const missing = documents.filter(document => new Date(document.created_at) < cutoff && !present.has(document.storage_key)).map(document => document.storage_key);
  return {candidateOrphans:candidates.sort(),missingObjects:missing.sort(),unrecognizedObjects:unknownObjects.sort()};
}
