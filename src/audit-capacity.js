export function assessAuditCapacity(sizeBytes, limitBytes) {
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 0 || !Number.isSafeInteger(limitBytes) || limitBytes <= 0) {
    throw new Error('Audit size and limit must be safe integers; limit must be positive');
  }
  return { healthy: sizeBytes < limitBytes, sizeBytes, limitBytes };
}
