import { writeFile, readFile } from 'node:fs/promises';

// The checkpoint must be created and kept by a separate operator identity in a
// directory the application OS account and database role cannot write.
export async function writeCheckpoint(path, chain) {
  if (!chain.valid || !Number.isSafeInteger(chain.count) || chain.count < 0 || !/^[0-9a-f]{64}$/.test(chain.hash)) throw new Error('Cannot checkpoint an invalid chain');
  await writeFile(path, JSON.stringify({version:1,count:chain.count,hash:chain.hash}) + '\n', {flag:'wx',mode:0o600});
}
export async function readCheckpoint(path) {
  const checkpoint = JSON.parse(await readFile(path,'utf8'));
  if (checkpoint.version !== 1 || !Number.isSafeInteger(checkpoint.count) || checkpoint.count < 0 || !/^[0-9a-f]{64}$/.test(checkpoint.hash)) throw new Error('Invalid checkpoint');
  return {count:checkpoint.count,hash:checkpoint.hash};
}
