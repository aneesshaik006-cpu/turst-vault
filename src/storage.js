import { mkdir, writeFile, unlink, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { put, get, del } from '@vercel/blob';

const blob = process.env.STORAGE_DRIVER === 'vercel-blob';
if (process.env.NODE_ENV === 'production' && (!blob || !process.env.BLOB_READ_WRITE_TOKEN)) throw new Error('Production requires private Vercel Blob storage');
const directory = process.env.STORAGE_DIR || fileURLToPath(new URL('../.local/documents/', import.meta.url));
function validateKey(key) {
  // Storage identifiers are generated UUIDv4 values, never user filenames or
  // arbitrary paths, even if a database record is damaged or tampered with.
  if (typeof key !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(key)) throw new Error('Invalid storage key');
}
export async function storeFile(key, data) {
  validateKey(key);
  if (blob) { await put(key, data, { access:'private', addRandomSuffix:false, allowOverwrite:false, contentType:'application/octet-stream' }); return; }
  await mkdir(directory, {recursive:true, mode:0o700});
  await writeFile(join(directory,key),data,{flag:'wx',mode:0o600});
}
export async function removeFile(key) {
  validateKey(key);
  if (blob) return del(key);
  return unlink(join(directory,key));
}
export async function loadFile(key) {
  validateKey(key);
  if (!blob) return readFile(join(directory,key));
  const result = await get(key, {access:'private',useCache:false});
  if (!result || result.statusCode !== 200) throw new Error('File unavailable');
  return Buffer.from(await new Response(result.stream).arrayBuffer());
}
