#!/usr/bin/env node
// Copy committed daoUI sources; EAS builds from these files without sibling repos.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = join(root, 'src/components/fields.generated');
const receipt = join(output, 'source.json');
const hash = data => createHash('sha256').update(data).digest('hex');
if (process.argv.includes('--check')) {
  const source = JSON.parse(readFileSync(receipt, 'utf8'));
  const actual = readdirSync(output).filter(name => name !== 'source.json').sort();
  if (JSON.stringify(actual) !== JSON.stringify(Object.keys(source.files).sort())) throw new Error('daoUI fields file list differs from its receipt');
  for (const [name, expected] of Object.entries(source.files)) if (hash(readFileSync(join(output, name))) !== expected) throw new Error(`daoUI field source drift: ${name}`);
  console.log(`daoUI fields verified: ${source.commit}`);
} else {
  const source = process.env.DAOUI_PATH ?? resolve(root, '../daoUI');
  const git = args => execFileSync('git', ['-C', source, ...args], { encoding: 'utf8' });
  const commit = git(['rev-parse', process.env.DAOUI_REF ?? 'HEAD']).trim();
  const files = git(['ls-tree', '--name-only', commit, 'rn/fields/']).trim().split('\n').filter(name => /\.(ts|tsx)$/.test(name));
  if (!files.length) throw new Error('No committed daoUI fields found; update daoUI or set DAOUI_PATH/DAOUI_REF');
  mkdirSync(output, { recursive: true });
  const hashes = {};
  for (const file of files) {
    const name = file.split('/').at(-1);
    const data = execFileSync('git', ['-C', source, 'show', `${commit}:${file}`]);
    writeFileSync(join(output, name), data);
    hashes[name] = hash(data);
  }
  writeFileSync(receipt, JSON.stringify({ repository: 'studiozojer/daoUI', commit, files: hashes }, null, 2) + '\n');
  console.log(`Synced daoUI fields: ${commit}`);
}
