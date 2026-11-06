export function checkpointIsFresh(modifiedAt, now, maxAgeHours) {
  if (!(modifiedAt instanceof Date) || !Number.isFinite(modifiedAt.valueOf()) || !(now instanceof Date) || !Number.isFinite(now.valueOf())) throw new Error('Invalid checkpoint timestamp');
  if (!Number.isFinite(maxAgeHours) || maxAgeHours <= 0 || maxAgeHours > 24 * 365) throw new Error('Invalid checkpoint maximum age');
  const age = now.valueOf() - modifiedAt.valueOf();
  return age >= 0 && age <= maxAgeHours * 60 * 60 * 1000;
}
