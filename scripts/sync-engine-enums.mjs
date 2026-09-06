#!/usr/bin/env node
// Generates src/features/chart/schema/enums.gen.ts from kairos-engine's YAML
// enum definitions (codegen/*.yaml), the single source of truth the Rust and
// Swift generators also consume.
//
// The output is COMMITTED rather than resolved at build time, because CI
// builds this repo alone and ../kairos-engine does not exist there — the same
// constraint that shaped sync-tokens.mjs, which this follows.
//
// Run: npm run sync-engine-enums
// Override the engine location: KAIROS_ENGINE_PATH=/path/to/kairos.rs npm run sync-engine-enums

import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ENGINE = process.env.KAIROS_ENGINE_PATH ?? join(HERE, '..', '..', 'kairos-engine');
const OUT = join(HERE, '..', 'src', 'features', 'chart', 'schema', 'enums.gen.ts');

function die(message) {
  // Fail loudly rather than emitting an empty file. A generator that silently
  // produces nothing is the nullglob failure: the build stays green and the
  // chart renders with missing enums.
  console.error(`sync-engine-enums: ${message}`);
  process.exit(1);
}

if (!existsSync(ENGINE)) {
  die(`kairos-engine not found at ${ENGINE}. Clone it beside this repo, or set KAIROS_ENGINE_PATH.`);
}

const generator = join(ENGINE, 'codegen', 'generate_ts.py');
if (!existsSync(generator)) die(`${generator} does not exist — is this really kairos-engine?`);

// Prefer codegen's venv (generate.sh bootstraps it); fall back to system python3.
const venvPython = join(ENGINE, 'codegen', '.venv', 'bin', 'python3');
const python = existsSync(venvPython) ? venvPython : 'python3';

let sourceCommit = 'unknown';
try {
  sourceCommit = execFileSync('git', ['-C', ENGINE, 'log', '-1', '--format=%H'], {
    encoding: 'utf8',
  }).trim();
} catch {
  console.warn('sync-engine-enums: could not read kairos-engine HEAD; stamping "unknown"');
}

let body;
try {
  body = execFileSync(python, [generator], {
    cwd: ENGINE,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  });
} catch (error) {
  die(`generate_ts.py failed:\n${error.stderr ?? error.message}`);
}

if (!body.includes('CELESTIAL_BODIES')) {
  die('generate_ts.py produced output without CELESTIAL_BODIES — refusing to write it.');
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, body);
console.log(`sync-engine-enums: wrote enums.gen.ts from kairos-engine @ ${sourceCommit}`);
