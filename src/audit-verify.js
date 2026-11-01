import { createHash } from 'node:crypto';

// Older events hashed JSON before PostgreSQL jsonb reordered object keys.
// Try each ordering of the small, flat metadata objects used by this app.
function metadataVariants(metadata) {
  if (!metadata || Array.isArray(metadata) || typeof metadata !== 'object') return [];
  const keys = Object.keys(metadata);
  if (keys.length > 6 || keys.some(k => metadata[k] !== null && typeof metadata[k] === 'object')) return [];
  const permutations = (list) => list.length < 2 ? [list] : list.flatMap((key, i) => permutations(list.filter((_, n) => n !== i)).map(rest => [key, ...rest]));
  return permutations(keys).map(order => Object.fromEntries(order.map(key => [key, metadata[key]])));
}
export function verifyAuditChain(events, checkpoint = null) {
  if (checkpoint && (!Number.isSafeInteger(checkpoint.count) || checkpoint.count < 0 || checkpoint.count > events.length || !/^[0-9a-f]{64}$/.test(checkpoint.hash))) return {valid:false, reason:'checkpoint mismatch'};
  let previous = '0'.repeat(64);
  if (checkpoint?.count === 0 && checkpoint.hash !== previous) return {valid:false, reason:'checkpoint mismatch'};
  let seen = 0;
  for (const event of events) {
    if (event.previous_hash !== previous) return {valid:false, reason:'broken link', sequence:String(event.seq)};
    const date = event.occurred_at instanceof Date ? event.occurred_at : new Date(event.occurred_at);
    if (Number.isNaN(date.valueOf())) return {valid:false, reason:'invalid timestamp', sequence:String(event.seq)};
    const valid = metadataVariants(event.metadata).some(metadata => {
      const payload = JSON.stringify([event.event_id,date.toISOString(),event.actor_id,event.actor_role,event.action,event.document_id,event.result,metadata]);
      return createHash('sha256').update(previous + payload).digest('hex') === event.current_hash;
    });
    if (!valid) return {valid:false, reason:'event hash mismatch or unsupported metadata', sequence:String(event.seq)};
    previous = event.current_hash;
    seen++;
    if (checkpoint && seen === checkpoint.count && checkpoint.hash !== previous) return {valid:false, reason:'checkpoint mismatch'};
  }
  return {valid:true, count:events.length, hash:previous, checkpointVerified:Boolean(checkpoint)};
}
