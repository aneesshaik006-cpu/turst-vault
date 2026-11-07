import express from 'express';
import helmet from 'helmet';
import { loginLimit } from './login-throttle.js';
import { pool } from './db.js';
import { audit, auditedTransaction } from './audit.js';
import { verifyPassword, createSessionToken, hashSessionToken } from './auth-crypto.js';
import { fileURLToPath } from 'node:url';
import multer from 'multer';
import { randomUUID, createHash } from 'node:crypto';
import { storeFile, removeFile, loadFile } from './storage.js';
import { canAccessDocument } from './authorization.js';
import { scanDocument, scannerRequired } from './malware-scan.js';
import { isSearchDate } from './search-date.js';

const app = express();
const origin = process.env.APP_ORIGIN;
if (!origin) throw new Error('APP_ORIGIN is required');
const secure = process.env.NODE_ENV === 'production';
if (secure && !origin.startsWith('https://')) throw new Error('Production APP_ORIGIN must use HTTPS');
app.disable('x-powered-by');
app.use(helmet());
app.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
// All unsafe browser requests must be same-origin, including login/logout.
app.use(async (req, res, next) => {
  try {
    if (!['GET','HEAD','OPTIONS'].includes(req.method) && req.get('origin') !== origin) {
      await audit({action:'REQUEST_REJECTED',result:'denied',metadata:{reason:'origin'}});
      return res.status(403).json({ error: 'Request rejected' });
    }
    next();
  } catch (error) { next(error); }
});
app.use(express.json({ limit: '16kb' }));
const cookieOptions = { httpOnly: true, secure, sameSite: 'strict', path: '/', maxAge: 8 * 60 * 60 * 1000 };
const validId = id => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
async function rejectUnauthenticated(req,res) {
  // Never record cookies, tokens, request bodies or arbitrary URL text.
  const match = /^\/api\/documents(?:\/([^/]+))?(?:\/|$)/.exec(req.path);
  if (match) {
    const documentId = match[1] && validId(match[1]) ? match[1] : null;
    await audit({action:'ACCESS_DENIED',documentId,result:'denied',metadata:{operation:'unauthenticated_document_request',method:req.method}});
  }
  return res.status(401).json({ error: 'Authentication required' });
}
function sessionToken(req) {
  const matches = (req.headers.cookie ?? '').split(';').map(x => x.trim()).filter(x => x.startsWith('trustvault_session='));
  return matches.length === 1 ? matches[0].slice('trustvault_session='.length) : '';
}
async function authenticate(req, res, next) {
  try {
    const hash = hashSessionToken(sessionToken(req));
    if (!hash) return await rejectUnauthenticated(req,res);
    const result = await pool.query('SELECT u.id,u.email,u.role FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at > now() AND NOT u.disabled', [hash]);
    if (!result.rowCount) return await rejectUnauthenticated(req,res);
    req.user = result.rows[0]; req.sessionHash = hash; next();
  } catch (err) { next(err); }
}
app.post('/api/auth/login', loginLimit, async (req, res, next) => {
  try {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase().slice(0, 320) : '';
    const password = req.body?.password;
    const result = await pool.query('SELECT id,email,role,disabled,password_hash FROM users WHERE email=$1', [email]);
    const user = result.rows[0];
    const valid = await verifyPassword(password, user?.password_hash);
    if (!user || user.disabled || !valid) {
      await audit({ action: 'LOGIN_FAILED', result: 'denied' });
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const { token, tokenHash } = createSessionToken();
    await auditedTransaction(async client => {
      await client.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now() + interval '8 hours')", [tokenHash, user.id]);
      await audit({ actor: user, action: 'LOGIN', result: 'success' },client);
    });
    res.cookie('trustvault_session', token, cookieOptions).json({ id: user.id, email: user.email, role: user.role });
  } catch (err) { next(err); }
});
app.get('/api/auth/me', authenticate, (req, res) => res.json(req.user));
app.post('/api/auth/logout', authenticate, async (req, res, next) => {
  try {
    await auditedTransaction(async client => {
      await client.query('DELETE FROM sessions WHERE token_hash=$1', [req.sessionHash]);
      await audit({ actor: req.user, action: 'LOGOUT', result: 'success' },client);
    });
    res.clearCookie('trustvault_session', { ...cookieOptions, maxAge: undefined }).status(204).end();
  } catch (err) { next(err); }
});
const upload = multer({ storage: multer.memoryStorage(), preservePath: true, limits: { fileSize: 4 * 1024 * 1024, files: 1, fields: 1 } });
app.get('/api/documents', authenticate, async (req, res, next) => {
  try {
    const value = key => typeof req.query[key] === 'string' ? req.query[key].trim().slice(0, 120) : '';
    const name = value('name'), owner = value('owner'), category = value('category'), from = value('from'), to = value('to');
    if ((from && !isSearchDate(from)) || (to && !isSearchDate(to)) || (from && to && from > to)) {
      await audit({actor:req.user,action:'REQUEST_REJECTED',result:'denied',metadata:{reason:'invalid_search_date'}});
      return res.status(400).json({error:'Invalid date'});
    }
    const result = await pool.query(`SELECT d.id,d.name,d.category,d.created_at,
      CASE WHEN d.owner_id=$1 THEN 'OWNER' ELSE p.permission END AS permission
      FROM documents d JOIN users owner ON owner.id=d.owner_id LEFT JOIN document_permissions p ON p.document_id=d.id AND p.user_id=$1
      WHERE NOT d.deleted AND (d.owner_id=$1 OR p.permission IN ('READ','EDIT'))
      AND position(lower($2) in lower(d.name)) > 0 AND position(lower($3) in lower(owner.email)) > 0
      AND position(lower($4) in lower(d.category)) > 0
      AND ($5 = '' OR to_char(d.created_at AT TIME ZONE 'UTC','YYYY-MM-DD') >= $5)
      AND ($6 = '' OR to_char(d.created_at AT TIME ZONE 'UTC','YYYY-MM-DD') <= $6)
      ORDER BY d.created_at DESC LIMIT 100`, [req.user.id,name,owner,category,from,to]);
    res.json({ documents: result.rows });
  } catch (err) { next(err); }
});
async function authorizeDocument(req, res, operation) {
  const id = req.params.id;
  if (!validId(id)) { await audit({actor:req.user,action:'ACCESS_DENIED',result:'denied',metadata:{operation,reason:'invalid_document_id'}}); res.status(404).json({error:'Not found'}); return null; }
  const result = await pool.query('SELECT d.*,p.permission FROM documents d LEFT JOIN document_permissions p ON p.document_id=d.id AND p.user_id=$2 WHERE d.id=$1', [id,req.user.id]);
  const row = result.rows[0];
  const allowed = row && canAccessDocument({user:{...req.user,disabled:false},document:{id:row.id,ownerId:row.owner_id,deleted:row.deleted},grant:row.permission ? {userId:req.user.id,documentId:row.id,permission:row.permission}:null,operation});
  if (!allowed) { await audit({actor:req.user,action:'ACCESS_DENIED',documentId:id,result:'denied',metadata:{operation}}); res.status(404).json({error:'Not found'}); return null; }
  return row;
}
app.get('/api/documents/:id/permissions', authenticate, async (req,res,next) => {
  try {
    if (!await authorizeDocument(req,res,'managePermissions')) return;
    const result = await pool.query('SELECT p.user_id,u.email,p.permission FROM document_permissions p JOIN users u ON u.id=p.user_id WHERE p.document_id=$1 ORDER BY u.email',[req.params.id]);
    res.json({permissions:result.rows});
  } catch(err) { next(err); }
});
app.put('/api/documents/:id/permissions', authenticate, async (req,res,next) => {
  try {
    if (!await authorizeDocument(req,res,'managePermissions')) return;
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const permission = req.body?.permission;
    if (email.length > 320 || !['READ','EDIT'].includes(permission)) {
      await audit({actor:req.user,action:'REQUEST_REJECTED',documentId:req.params.id,result:'denied',metadata:{reason:'invalid_permission'}});
      return res.status(400).json({error:'Invalid permission or email'});
    }
    const target = await pool.query('SELECT id FROM users WHERE email=$1 AND NOT disabled',[email]);
    if (!target.rowCount || target.rows[0].id === req.user.id) {
      await audit({actor:req.user,action:'REQUEST_REJECTED',documentId:req.params.id,result:'denied',metadata:{reason:'invalid_recipient'}});
      return res.status(400).json({error:'Invalid recipient'});
    }
    const targetId = target.rows[0].id;
    await auditedTransaction(async client => {
      const inserted = await client.query(`INSERT INTO document_permissions(document_id,user_id,permission,granted_by)
        SELECT id,$2,$3,$4 FROM documents WHERE id=$1 AND owner_id=$4 AND NOT deleted
        ON CONFLICT(document_id,user_id) DO UPDATE SET permission=EXCLUDED.permission,granted_by=EXCLUDED.granted_by,updated_at=now() RETURNING document_id`,[req.params.id,targetId,permission,req.user.id]);
      if (!inserted.rowCount) throw new Error('Document no longer available');
      await audit({actor:req.user,action:'PERMISSION_GRANTED_OR_CHANGED',documentId:req.params.id,result:'success',metadata:{targetUserId:targetId,permission}},client);
    });
    res.status(204).end();
  } catch(err) { next(err); }
});
app.delete('/api/documents/:id/permissions/:userId', authenticate, async (req,res,next) => {
  try {
    if (!await authorizeDocument(req,res,'managePermissions')) return;
    if (!validId(req.params.userId)) {
      await audit({actor:req.user,action:'REQUEST_REJECTED',documentId:req.params.id,result:'denied',metadata:{reason:'invalid_permission_target'}});
      return res.status(404).json({error:'Not found'});
    }
    const revoked=await auditedTransaction(async client => {
      const result=await client.query('DELETE FROM document_permissions WHERE document_id=$1 AND user_id=$2 RETURNING user_id',[req.params.id,req.params.userId]);
      if (!result.rowCount) return false;
      await audit({actor:req.user,action:'PERMISSION_REVOKED',documentId:req.params.id,result:'success',metadata:{targetUserId:req.params.userId}},client);
      return true;
    });
    if (!revoked) {
      await audit({actor:req.user,action:'REQUEST_REJECTED',documentId:req.params.id,result:'denied',metadata:{reason:'permission_not_found'}});
      return res.status(404).json({error:'Not found'});
    }
    res.status(204).end();
  } catch(err) { next(err); }
});
app.delete('/api/documents/:id', authenticate, async (req,res,next) => {
  try {
    if (!await authorizeDocument(req,res,'delete')) return;
    const deleted=await auditedTransaction(async client => {
      const result=await client.query('UPDATE documents SET deleted=true,updated_at=now() WHERE id=$1 AND owner_id=$2 AND NOT deleted RETURNING id',[req.params.id,req.user.id]);
      if (!result.rowCount) return false;
      await audit({actor:req.user,action:'DOCUMENT_DELETE',documentId:req.params.id,result:'success'},client);
      return true;
    });
    if (!deleted) return res.status(404).json({error:'Not found'});
    res.status(204).end();
  } catch(err) { next(err); }
});
app.patch('/api/documents/:id', authenticate, async (req,res,next) => {
  try {
    if (!await authorizeDocument(req,res,'edit')) return;
    const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
    const category = typeof req.body?.category === 'string' ? req.body.category.trim() : '';
    if (!name || name.length > 180 || !category || category.length > 80 || /[\\/\u0000-\u001f\u007f]/.test(name) || /[\u0000-\u001f\u007f]/.test(category)) {
      await audit({actor:req.user,action:'REQUEST_REJECTED',documentId:req.params.id,result:'denied',metadata:{reason:'invalid_document_details'}});
      return res.status(400).json({error:'Invalid document details'});
    }
    // Repeat the current grant check in the write to prevent a revoked editor
    // from updating after revocation commits between lookup and update.
    const edited = await auditedTransaction(async client => {
      const result = await client.query(`UPDATE documents d SET name=$3,category=$4,updated_at=now()
      WHERE d.id=$1 AND NOT d.deleted AND (d.owner_id=$2 OR EXISTS
      (SELECT 1 FROM document_permissions p WHERE p.document_id=d.id AND p.user_id=$2 AND p.permission='EDIT')) RETURNING d.id`,[req.params.id,req.user.id,name,category]);
      if (!result.rowCount) return false;
      await audit({actor:req.user,action:'DOCUMENT_EDIT',documentId:req.params.id,result:'success'},client);
      return true;
    });
    if (!edited) { await audit({actor:req.user,action:'ACCESS_DENIED',documentId:req.params.id,result:'denied',metadata:{operation:'edit'}}); return res.status(404).json({error:'Not found'}); }
    res.status(204).end();
  } catch(err) { next(err); }
});
app.get('/api/admin/activity', authenticate, async (req,res,next) => {
  try {
    if (req.user.role !== 'ADMIN') { await audit({actor:req.user,action:'ACCESS_DENIED',result:'denied',metadata:{operation:'admin_activity'}}); return res.status(403).json({error:'Forbidden'}); }
    const result=await pool.query('SELECT seq,occurred_at,actor_id,actor_role,action,document_id,result,metadata FROM audit_events ORDER BY seq DESC LIMIT 100');
    res.json({events:result.rows});
  } catch(err) { next(err); }
});
async function requireUploadOwner(req,res,next) {
  if (req.user.role === 'OWNER') return next();
  try {
    await audit({actor:req.user,action:'DOCUMENT_UPLOAD',result:'denied',metadata:{reason:'role'}});
    return res.status(403).json({error:'Only document owners can upload'});
  } catch(error) { return next(error); }
}
async function rejectUpload(req,res,message) {
  await audit({actor:req.user,action:'DOCUMENT_UPLOAD',result:'denied',metadata:{reason:'invalid_upload'}});
  return res.status(400).json({error:message});
}
const parseDocumentFile=upload.single('file');
function parseDocumentUpload(req,res,next) {
  parseDocumentFile(req,res,async error=>{
    if (!error) return next();
    try {
      await audit({actor:req.user,action:'DOCUMENT_UPLOAD',result:'denied',metadata:{reason:'malformed_multipart'}});
      const oversized=error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE';
      return res.status(oversized?413:400).json({error:oversized?'File exceeds the 4 MB limit':'Invalid upload'});
    } catch (auditError) { return next(auditError); }
  });
}
app.post('/api/documents', authenticate, requireUploadOwner, parseDocumentUpload, async (req, res, next) => {
  try {
    const file = req.file;
    const category = typeof req.body?.category === 'string' ? req.body.category.trim() : '';
    if (!file || !file.size || !category || category.length > 80 || /[\u0000-\u001f\u007f]/.test(category)) return await rejectUpload(req,res,'Choose a file and category');
    const name = file.originalname;
    if (!name || name.length > 180 || /[\\/\u0000-\u001f\u007f]/.test(name) || (name.match(/\./g) || []).length !== 1) return await rejectUpload(req,res,'Invalid filename');
    const ext = name.slice(name.lastIndexOf('.')).toLowerCase();
    const pdf = ext === '.pdf' && file.mimetype === 'application/pdf' && file.buffer.subarray(0,5).toString() === '%PDF-';
    const png = ext === '.png' && file.mimetype === 'image/png' && file.buffer.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'));
    if (!pdf && !png) return await rejectUpload(req,res,'Only PDF and PNG files are supported');
    const scan = await scanDocument(file.buffer,{url:process.env.MALWARE_SCAN_URL,token:process.env.MALWARE_SCAN_TOKEN,required:scannerRequired(process.env)});
    if (scan === 'infected') {
      await audit({actor:req.user,action:'DOCUMENT_UPLOAD',result:'denied',metadata:{reason:'malware_detected'}});
      return res.status(400).json({error:'File could not be accepted'});
    }
    if (scan === 'unavailable') {
      await audit({actor:req.user,action:'DOCUMENT_UPLOAD',result:'failure',metadata:{reason:'scanner_unavailable'}});
      return res.status(503).json({error:'File scanning temporarily unavailable'});
    }
    const id = randomUUID(), key = randomUUID();
    try { await storeFile(key, file.buffer); }
    catch (error) {
      await audit({actor:req.user,action:'DOCUMENT_UPLOAD',result:'failure',metadata:{reason:'storage'}});
      throw error;
    }
    try {
      await auditedTransaction(async client => {
        await client.query('INSERT INTO documents(id,owner_id,name,category,storage_key,mime_type,size,checksum) VALUES($1,$2,$3,$4,$5,$6,$7,$8)', [id,req.user.id,name,category,key,file.mimetype,file.size,createHash('sha256').update(file.buffer).digest('hex')]);
        await audit({ actor:req.user, action:'DOCUMENT_UPLOAD', documentId:id, result:'success' },client);
      });
    } catch (error) {
      let cleanupFailed = false;
      try { await removeFile(key); } catch { cleanupFailed = true; }
      try { await audit({actor:req.user,action:'DOCUMENT_UPLOAD',result:'failure',metadata:{reason:cleanupFailed?'transaction_and_cleanup':'transaction'}}); }
      catch (auditError) { console.error('Upload failure audit failed:', auditError.code ?? auditError.name); }
      throw error;
    }
    res.status(201).json({ id });
  } catch (err) { next(err); }
});
app.get('/api/documents/:id/download', authenticate, async (req, res, next) => {
  try {
    const id = req.params.id;
    const row = await authorizeDocument(req,res,'read');
    if (!row) return;
    let content;
    try {
      content = await loadFile(row.storage_key);
      if (content.length !== row.size || createHash('sha256').update(content).digest('hex') !== row.checksum) throw new Error('Stored document integrity check failed');
    } catch (error) {
      await audit({actor:req.user,action:'DOCUMENT_DOWNLOAD',documentId:id,result:'failure',metadata:{reason:'storage_or_integrity'}});
      throw error;
    }
    await audit({actor:req.user,action:'DOCUMENT_DOWNLOAD',documentId:id,result:'success'});
    res.set('Content-Type','application/octet-stream');
    res.attachment(row.name);
    res.send(content);
  } catch (err) { next(err); }
});
app.use(express.static(fileURLToPath(new URL('../public', import.meta.url)), { index: 'index.html' }));
app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use(async (err, req, res, next) => {
  if (err.type === 'entity.parse.failed' || err.type === 'entity.too.large') {
    try {
      await audit({action:'REQUEST_REJECTED',result:'denied',metadata:{reason:err.type === 'entity.parse.failed' ? 'invalid_json' : 'body_too_large'}});
    } catch (auditError) { console.error('Audit failed:', auditError.code ?? auditError.name); return res.status(500).json({error:'Request failed'}); }
    return res.status(err.type === 'entity.parse.failed' ? 400 : 413).json({error:err.type === 'entity.parse.failed' ? 'Invalid request body' : 'Request body too large'});
  }
  console.error('Request failed:', err.code ?? err.name);
  res.status(500).json({ error: 'Request failed' });
});
const port = Number(process.env.PORT || 3000);
if (!process.env.VERCEL) app.listen(port, '127.0.0.1', () => console.log(`TrustVault listening on ${port}`));
export default app;
