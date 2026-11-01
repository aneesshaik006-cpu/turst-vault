import { readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
for (const dir of ['src','scripts','test','public']) {
  for (const file of (await readdir(dir)).filter(name=>name.endsWith('.js')).sort()) {
    const path=`${dir}/${file}`;
    const check=spawnSync(process.execPath,['--check',path],{stdio:'inherit'});
    if (check.status !== 0) process.exit(check.status ?? 1);
  }
}
console.log('JavaScript syntax checks passed');
