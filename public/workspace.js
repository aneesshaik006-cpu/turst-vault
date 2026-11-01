const email = document.querySelector('#user-email');
const feedback = document.querySelector('#feedback');
const loading = document.querySelector('#loading');
const empty = document.querySelector('#empty');
const table = document.querySelector('#table');
const rows = document.querySelector('#document-rows');
const count = document.querySelector('#document-count');
const uploadSection = document.querySelector('#upload-section');
const uploadForm = document.querySelector('#upload-form');
const searchForm = document.querySelector('#search-form');
const permissionsSection = document.querySelector('#permissions-section');
const permissionsForm = document.querySelector('#permissions-form');
const permissionsList = document.querySelector('#permissions-list');
const permissionsFeedback = document.querySelector('#permissions-feedback');
const editSection = document.querySelector('#edit-section');
const editForm = document.querySelector('#edit-form');
const editFeedback = document.querySelector('#edit-feedback');
let editingDocument = null;
let editTrigger = null;
let selectedDocument = null;
const activitySection = document.querySelector('#activity-section');
const activityList = document.querySelector('#activity-list');
const activityStatus = document.querySelector('#activity-status');
const showActivity = document.querySelector('#show-activity');


function message(text, success = false) {
  feedback.textContent = text;
  feedback.classList.toggle('success', success);
}
async function request(url, options) {
  const response = await fetch(url, options);
  if (response.status === 401) { location.replace('/'); throw new Error('Session expired'); }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const error = new Error(typeof body.error === 'string' ? body.error : 'Something went wrong. Please try again.');
    error.status = response.status;
    throw error;
  }
  return response;
}
function renderDocuments(documents) {
  rows.replaceChildren();
  count.textContent = `${documents.length} ${documents.length === 1 ? 'file' : 'files'}`;
  empty.hidden = documents.length !== 0;
  const filtering = [...new FormData(searchForm).values()].some(value => String(value).trim());
  empty.querySelector('h3').textContent = filtering ? 'No matching documents' : 'No documents yet';
  empty.querySelector('p').textContent = filtering ? 'Try changing or clearing your filters.' : 'Files you upload or receive access to will appear here.';
  table.hidden = documents.length === 0;
  for (const doc of documents) {
    const row = document.createElement('tr');
    const date = new Date(doc.created_at);
    const values = [doc.name, doc.category, doc.permission, Number.isNaN(date.valueOf()) ? '—' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date)];
    const labels = ['Name', 'Category', 'Access', 'Added'];
    values.forEach((value, index) => { const cell = document.createElement('td'); cell.dataset.label = labels[index]; cell.textContent = value || '—'; row.append(cell); });
    const action = document.createElement('td'); action.className = 'document-actions';
    const link = document.createElement('a');
    link.href = `/api/documents/${encodeURIComponent(doc.id)}/download`;
    link.className = 'download'; link.textContent = 'Download';
    link.setAttribute('aria-label', `Download ${doc.name}`);
    const actions = document.createElement('div');
    actions.className = 'action-group'; actions.append(link);
    if (doc.permission === 'OWNER' || doc.permission === 'EDIT') {
      const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'action-button'; edit.textContent = 'Edit';
      edit.setAttribute('aria-label', `Edit details for ${doc.name}`);
      edit.addEventListener('click', () => openEdit(doc, edit)); actions.append(edit);
    }
    if (doc.permission === 'OWNER') {
      const share = document.createElement('button'); share.type = 'button'; share.className = 'action-button'; share.textContent = 'Access';
      share.setAttribute('aria-label', `Manage access to ${doc.name}`);
      share.addEventListener('click', () => openPermissions(doc)); actions.append(share);
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'action-button danger'; remove.textContent = 'Delete';
      remove.setAttribute('aria-label', `Delete ${doc.name}`);
      remove.addEventListener('click', async () => {
        if (!window.confirm(`Delete “${doc.name}”? It will no longer be accessible.`)) return;
        remove.disabled = true; message('');
        try {
          await request(`/api/documents/${encodeURIComponent(doc.id)}`, { method: 'DELETE' });
          if (selectedDocument?.id === doc.id) closePermissions();
          if (await loadDocuments()) message('Document deleted.', true);
          else message('Document deleted, but the list could not be refreshed. Please reload.');
        }
        catch (error) { message(error.message); } finally { remove.disabled = false; }
      }); actions.append(remove);
    }
    action.append(actions); row.append(action); rows.append(row);
  }
}
function closeEdit(restoreFocus = true) {
  editingDocument = null; editSection.hidden = true; editForm.reset(); editFeedback.textContent = '';
  if (restoreFocus && editTrigger?.isConnected) editTrigger.focus();
  editTrigger = null;
}
function openEdit(doc, trigger) {
  editingDocument = doc; editTrigger = trigger; editFeedback.textContent = '';
  editForm.elements.name.value = doc.name; editForm.elements.category.value = doc.category;
  editSection.hidden = false; editSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  editForm.elements.name.focus();
}
document.querySelector('#cancel-edit').addEventListener('click', () => closeEdit());
editForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!editingDocument) return;
  const id = editingDocument.id;
  const button = editForm.querySelector('button[type=submit]');
  button.disabled = true; button.textContent = 'Saving…'; editFeedback.textContent = '';
  try {
    await request(`/api/documents/${encodeURIComponent(id)}`, {method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:editForm.elements.name.value.trim(),category:editForm.elements.category.value.trim()})});
    closeEdit(false);
    if (await loadDocuments()) message('Document details updated.', true);
    else message('Document details saved, but the list could not be refreshed. Please reload.');
  } catch (error) {
    editFeedback.textContent = error.status === 404 ? 'This document is unavailable or you no longer have access. Refresh the document list and try again.' : error.message;
  } finally { button.disabled = false; button.textContent = 'Save changes'; }
});
async function loadDocuments() {
  loading.hidden = false; empty.hidden = true; table.hidden = true; count.textContent = '';
  try {
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(searchForm)) if (String(value).trim()) params.set(key, String(value).trim());
    const result = await (await request(`/api/documents${params.size ? `?${params}` : ''}`)).json();
    if (!Array.isArray(result.documents)) throw new Error('Unable to load documents.');
    renderDocuments(result.documents);
    return true;
  } catch (error) { message(error.message); return false; }
  finally { loading.hidden = true; }
}
searchForm.addEventListener('submit', async event => { event.preventDefault(); message(''); await loadDocuments(); });
document.querySelector('#clear-search').addEventListener('click', async () => { searchForm.reset(); message(''); await loadDocuments(); });
function closePermissions() { selectedDocument = null; permissionsSection.hidden = true; permissionsList.replaceChildren(); permissionsFeedback.textContent = ''; permissionsForm.reset(); }
document.querySelector('#close-permissions').addEventListener('click', closePermissions);
async function openPermissions(doc) {
  selectedDocument = doc; permissionsSection.hidden = false;
  document.querySelector('#permissions-document').textContent = doc.name;
  permissionsFeedback.textContent = ''; permissionsForm.reset();
  permissionsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  await loadPermissions(doc.id);
}
async function loadPermissions(id) {
  permissionsList.replaceChildren(); document.querySelector('#permissions-loading').hidden = false;
  try {
    const data = await (await request(`/api/documents/${encodeURIComponent(id)}/permissions`)).json();
    if (selectedDocument?.id !== id) return;
    if (!Array.isArray(data.permissions)) throw new Error('Unable to load access.');
    if (!data.permissions.length) { const item = document.createElement('li'); item.textContent = 'No one else has access.'; permissionsList.append(item); }
    for (const grant of data.permissions) {
      const item = document.createElement('li');
      const info = document.createElement('span'); info.className = 'grant-info'; info.textContent = `${grant.email} · ${grant.permission === 'EDIT' ? 'Edit' : 'Read'}`;
      const revoke = document.createElement('button'); revoke.type = 'button'; revoke.className = 'action-button danger'; revoke.textContent = 'Revoke';
      revoke.setAttribute('aria-label', `Revoke access for ${grant.email}`);
      revoke.addEventListener('click', async () => {
        if (!window.confirm(`Revoke access for ${grant.email}?`)) return;
        revoke.disabled = true; permissionsFeedback.textContent = '';
        try { await request(`/api/documents/${encodeURIComponent(id)}/permissions/${encodeURIComponent(grant.user_id)}`, {method:'DELETE'}); await loadPermissions(id); }
        catch (error) { permissionsFeedback.textContent = error.message; } finally { revoke.disabled = false; }
      });
      item.append(info, revoke); permissionsList.append(item);
    }
  } catch (error) { if (selectedDocument?.id === id) permissionsFeedback.textContent = error.message; }
  finally { if (selectedDocument?.id === id) document.querySelector('#permissions-loading').hidden = true; }
}
permissionsForm.addEventListener('submit', async event => {
  event.preventDefault(); if (!selectedDocument) return;
  const id = selectedDocument.id; const button = permissionsForm.querySelector('button[type=submit]');
  button.disabled = true; permissionsFeedback.textContent = '';
  try {
    await request(`/api/documents/${encodeURIComponent(id)}/permissions`, {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:permissionsForm.elements.email.value.trim(),permission:permissionsForm.elements.permission.value})});
    permissionsForm.reset(); await loadPermissions(id);
  } catch (error) { permissionsFeedback.textContent = error.message; }
  finally { button.disabled = false; }
});
function openUpload() { uploadSection.hidden = false; document.querySelector('#file').focus(); }
document.querySelector('#show-upload').addEventListener('click', openUpload);
document.querySelector('#empty-upload').addEventListener('click', openUpload);
document.querySelector('#cancel-upload').addEventListener('click', () => { uploadSection.hidden = true; uploadForm.reset(); document.querySelector('#show-upload').focus(); });
uploadForm.addEventListener('submit', async event => {
  event.preventDefault(); message('');
  const button = uploadForm.querySelector('button[type=submit]'); button.disabled = true; button.textContent = 'Uploading…';
  try {
    await request('/api/documents', { method: 'POST', body: new FormData(uploadForm) });
    uploadForm.reset(); uploadSection.hidden = true;
    if (await loadDocuments()) message('Document uploaded.', true);
    else message('Document uploaded, but the list could not be refreshed. Please reload.');
  } catch (error) { message(error.message); }
  finally { button.disabled = false; button.textContent = 'Upload document'; }
});
document.querySelector('#logout').addEventListener('click', async () => {
  try { await request('/api/auth/logout', { method: 'POST' }); location.replace('/'); }
  catch (error) { message(error.message); }
});
async function loadActivity() {
  const refresh = document.querySelector('#refresh-activity');
  refresh.disabled = true; activityList.replaceChildren(); activityStatus.textContent = 'Loading security activity…';
  try {
    const data = await (await request('/api/admin/activity')).json();
    if (!Array.isArray(data.events)) throw new Error('Unable to load security activity.');
    if (!data.events.length) { activityStatus.textContent = 'No security activity yet.'; return; }
    activityStatus.textContent = `${data.events.length} ${data.events.length === 1 ? 'event' : 'events'} loaded.`;
    for (const event of data.events) {
      const item = document.createElement('li');
      const heading = document.createElement('div'); heading.className = 'activity-event-heading';
      const action = document.createElement('strong'); action.textContent = typeof event.action === 'string' ? event.action.replaceAll('_',' ') : 'Unknown action';
      const result = document.createElement('span'); result.className = 'activity-result'; result.textContent = typeof event.result === 'string' ? event.result : 'unknown';
      heading.append(action,result);
      const details = document.createElement('p');
      const when = new Date(event.occurred_at);
      const date = Number.isNaN(when.valueOf()) ? 'Unknown time' : new Intl.DateTimeFormat(undefined,{dateStyle:'medium',timeStyle:'short'}).format(when);
      const actor = event.actor_id || 'Unknown actor';
      const role = event.actor_role ? ` (${event.actor_role})` : '';
      details.textContent = `${date} · ${actor}${role}${event.document_id ? ` · Document ${event.document_id}` : ''}`;
      item.append(heading,details);
      if (event.metadata && typeof event.metadata === 'object' && Object.keys(event.metadata).length) {
        const context = document.createElement('p'); context.className = 'activity-context';
        context.textContent = `Context: ${JSON.stringify(event.metadata)}`; item.append(context);
      }
      activityList.append(item);
    }
  } catch (error) { activityStatus.textContent = error.message; }
  finally { refresh.disabled = false; }
}
showActivity.addEventListener('click', async () => {
  activitySection.hidden = false; showActivity.setAttribute('aria-expanded','true');
  await loadActivity();
});
document.querySelector('#refresh-activity').addEventListener('click', loadActivity);
document.querySelector('#close-activity').addEventListener('click', () => {
  activitySection.hidden = true; showActivity.setAttribute('aria-expanded','false');
  activityList.replaceChildren(); activityStatus.textContent = ''; showActivity.focus();
});
(async () => {
  try {
    const user = await (await request('/api/auth/me')).json();
    email.textContent = user.email;
    document.querySelector('#show-upload').hidden = user.role !== 'OWNER';
    document.querySelector('#empty-upload').hidden = user.role !== 'OWNER';
    showActivity.hidden = user.role !== 'ADMIN';
    await loadDocuments();
  } catch (error) { loading.hidden = true; message(error.message); }
})();
