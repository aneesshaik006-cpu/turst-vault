import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm, symlink } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

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
    const publicPath=fileURLToPath(new URL('../public/',import.meta.url));
    const publicLink=join(root,'public-link');
    await symlink(publicPath,publicLink);
    for (const [index,directory] of [publicPath,publicLink].entries()) {
      process.env.STORAGE_DIR=directory;
      const unsafe=await import(`../src/storage.js?public-storage-test=${index}`);
      await assert.rejects(unsafe.storeFile(randomUUID(),content),/outside the public directory/);
      await assert.rejects(unsafe.loadFile(randomUUID()),/outside the public directory/);
    }
  } finally { await rm(root,{recursive:true,force:true}); }
});
