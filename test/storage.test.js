import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

test('local storage accepts generated keys and rejects path manipulation', async () => {
  const root=await mkdtemp(join(tmpdir(),'trustvault-storage-'));
  process.env.STORAGE_DIR=root;
  delete process.env.STORAGE_DRIVER;
  try {
    const {storeFile,loadFile,removeFile}=await import('../src/storage.js');
    for(const key of ['../outside','/etc/passwd','file.pdf','00000000-0000-1000-8000-000000000000',null]) {
      await assert.rejects(storeFile(key,Buffer.from('x')),/Invalid storage key/);
      await assert.rejects(loadFile(key),/Invalid storage key/);
      await assert.rejects(removeFile(key),/Invalid storage key/);
    }
    const key=randomUUID(), content=Buffer.from('synthetic');
    await storeFile(key,content);
    assert.deepEqual(await loadFile(key),content);
    await assert.rejects(storeFile(key,content),{code:'EEXIST'});
    await removeFile(key);
    await assert.rejects(loadFile(key),{code:'ENOENT'});
  } finally { await rm(root,{recursive:true,force:true}); }
});
