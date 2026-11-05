import { mkdir, writeFile, unlink, readFile, realpath } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, relative, isAbsolute, sep } from 'node:path';
import { put, get, del } from '@vercel/blob';

const blob = process.env.STORAGE_DRIVER === 'vercel-blob';
if (process.env.NODE_ENV === 'production' && (!blob || !process.env.BLOB_READ_WRITE_TOKEN)) throw new Error('Production requires private Vercel Blob storage');
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
  if (blob) { await put(key, data, { access:'private', addRandomSuffix:false, allowOverwrite:false, contentType:'application/octet-stream' }); return; }
  await writeFile(join(await localDirectory(),key),data,{flag:'wx',mode:0o600});
}
export async function removeFile(key) {
  validateKey(key);
  if (blob) return del(key);
  return unlink(join(await localDirectory(),key));
}
export async function loadFile(key) {
  validateKey(key);
  if (!blob) return readFile(join(await localDirectory(),key));
  const result = await get(key, {access:'private',useCache:false});
  if (!result || result.statusCode !== 200) throw new Error('File unavailable');
  return Buffer.from(await new Response(result.stream).arrayBuffer());
}
