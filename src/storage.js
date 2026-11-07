import { mkdir, writeFile, unlink, readFile, realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, relative, isAbsolute, sep } from 'node:path';
import { put, get, del } from '@vercel/blob';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

const blob = process.env.STORAGE_DRIVER === 'vercel-blob';
const neon = process.env.STORAGE_DRIVER === 'neon';
if (process.env.NODE_ENV === 'production' && !(blob && process.env.BLOB_READ_WRITE_TOKEN) && !neon) throw new Error('Production requires configured private storage');
let neonClient;
const neonBucket = process.env.NEON_STORAGE_BUCKET || 'assets';
if (neon) {
  const { AWS_ENDPOINT_URL_S3: endpoint, AWS_REGION: region, AWS_ACCESS_KEY_ID: accessKeyId, AWS_SECRET_ACCESS_KEY: secretAccessKey } = process.env;
  let parsed;
  try { parsed = new URL(endpoint); } catch { throw new Error('Neon storage requires a valid HTTPS endpoint'); }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') throw new Error('Neon storage requires a valid HTTPS endpoint');
  if (!region || !accessKeyId || !secretAccessKey || !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(neonBucket)) throw new Error('Neon storage configuration is incomplete');
  neonClient = new S3Client({ endpoint: parsed.origin, region, credentials: { accessKeyId, secretAccessKey }, forcePathStyle: true });
}
const directory = process.env.STORAGE_DIR || fileURLToPath(new URL('../.local/documents/', import.meta.url));
const publicDirectory = fileURLToPath(new URL('../public/', import.meta.url));
async function localDirectory() {
  await mkdir(directory, {recursive:true, mode:0o700});
  const [actual,publicRoot]=await Promise.all([realpath(directory),realpath(publicDirectory)]);
  const pathFromPublic=relative(publicRoot,actual);
  if (pathFromPublic === '' || (!pathFromPublic.startsWith('..'+sep) && pathFromPublic !== '..' && !isAbsolute(pathFromPublic))) throw new Error('Document storage must be outside the public directory');
  return actual;
}
function validateKey(key) {
  // Storage identifiers are generated UUIDv4 values, never user filenames or
  // arbitrary paths, even if a database record is damaged or tampered with.
  if (typeof key !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(key)) throw new Error('Invalid storage key');
}
export async function storeFile(key, data) {
  validateKey(key);
  if (neon) { await neonClient.send(new PutObjectCommand({Bucket:neonBucket,Key:key,Body:data,ContentType:'application/octet-stream',IfNoneMatch:'*'})); return; }
  if (blob) { await put(key, data, { access:'private', addRandomSuffix:false, allowOverwrite:false, contentType:'application/octet-stream' }); return; }
  await writeFile(join(await localDirectory(),key),data,{flag:'wx',mode:0o600});
}
export async function removeFile(key) {
  validateKey(key);
  if (neon) { await neonClient.send(new DeleteObjectCommand({Bucket:neonBucket,Key:key})); return; }
  if (blob) return del(key);
  return unlink(join(await localDirectory(),key));
}
export async function loadFile(key) {
  validateKey(key);
  if (neon) {
    const result = await neonClient.send(new GetObjectCommand({Bucket:neonBucket,Key:key}));
    if (!result.Body) throw new Error('File unavailable');
    return Buffer.from(await result.Body.transformToByteArray());
  }
  if (!blob) return readFile(join(await localDirectory(),key));
  const result = await get(key, {access:'private',useCache:false});
  if (!result || result.statusCode !== 200) throw new Error('File unavailable');
  return Buffer.from(await new Response(result.stream).arrayBuffer());
}

// Reconciliation is read-only; objects returned here are never deleted.
export async function listNeonObjects() {
  if (!neon) throw new Error('Neon storage is not configured');
  const objects = [], seen = new Set();
  let token;
  do {
    const page = await neonClient.send(new ListObjectsV2Command({Bucket:neonBucket,ContinuationToken:token}));
    for (const object of page.Contents ?? []) objects.push({pathname:object.Key,uploadedAt:object.LastModified});
    if (!page.IsTruncated) break;
    if (!page.NextContinuationToken || seen.has(page.NextContinuationToken)) throw new Error('Storage pagination did not advance');
    token = page.NextContinuationToken;
    seen.add(token);
  } while (true);
  return objects;
}
