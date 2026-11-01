import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, copyFile, unlink, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readCheckpoint, writeCheckpoint } from '../src/checkpoint.js';
import { verifyAuditChain } from '../src/audit-verify.js';

test('checkpoint is created once and is required to match the recorded prefix', async () => {
  const dir=await mkdtemp(join(tmpdir(),'trustvault-checkpoint-'));
  const path=join(dir,'checkpoint.json');
  try {
    const state={valid:true,count:0,hash:'0'.repeat(64)};
    await writeCheckpoint(path,state);
    assert.equal((await stat(path)).mode & 0o077,0);
    await assert.rejects(writeCheckpoint(path,state),{code:'EEXIST'});
    const checkpoint=await readCheckpoint(path);
    assert.deepEqual(checkpoint,{count:0,hash:'0'.repeat(64)});
    assert.equal(verifyAuditChain([],checkpoint).valid,true);
    assert.equal(verifyAuditChain([],{count:1,hash:'a'.repeat(64)}).valid,false);
    assert.equal(verifyAuditChain([],{count:0,hash:'a'.repeat(64)}).valid,false);
    const backup=join(dir,'backup.json');
    await copyFile(path,backup);
    await unlink(path);
    await copyFile(backup,path);
    assert.deepEqual(await readCheckpoint(path),checkpoint);
    const rotated=join(dir,'checkpoint-next.json');
    await writeCheckpoint(rotated,{valid:true,...checkpoint});
    assert.deepEqual(await readCheckpoint(rotated),checkpoint);
  } finally {await rm(dir,{recursive:true,force:true});}
});
