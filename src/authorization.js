/**
 * Object policy only. Callers MUST load the user, document and grant from
 * trusted current server-side storage for each operation; client input is not
 * evidence. This module does not authenticate requests or perform queries.
 */
export function canAccessDocument({ user, document, grant, operation }) {
  if (!user || user.disabled !== false || !user.id || !document ||
      !document.id || !document.ownerId || document.deleted !== false) return false;
  const operations = ['read', 'edit', 'delete', 'managePermissions'];
  if (!operations.includes(operation)) return false;
  if (document.ownerId === user.id) return true;
  if (operation === 'delete' || operation === 'managePermissions') return false;
  if (!grant || grant.documentId !== document.id || grant.userId !== user.id) return false;
  if (operation === 'read') return grant.permission === 'READ' || grant.permission === 'EDIT';
  return operation === 'edit' && grant.permission === 'EDIT';
}
