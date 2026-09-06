#!/usr/bin/env node
// Generates assets/chart-glyphs/** and src/features/chart/render/glyph-map.gen.ts
// from kairos-ios's glyph asset catalog.
//
// kairos-ios is a native Swift app and cannot be imported here, but the glyph
// SVGs are language-neutral art and are the real source — the same argument
// that shaped sync-tokens.mjs (daoUI → tokens.gen.ts). The output is COMMITTED
// rather than resolved at build time: CI builds this repo alone, and
// ../kairos-ios does not exist there.
//
// Layout mirrored from iOS: Xcode asset names are "<group>/<name>" where the
// group folder provides the namespace (`Image("glyphs/signs/aries")`,
// `Image("glyphs/rx")` — SVGRenderer.swift, DegreeTextRenderer.swift:202).
// Our map KEYS drop the "glyphs/" prefix: "signs/aries", "celestials/north
// node" (spaces preserved — the imageset folder name minus ".imageset" is the
// name), and "rx" stands group-less, exactly as it sits at the catalog root.
// Map keys are the iOS-name convention consumers key by; do not slugify them.
//
// COPIED FILENAMES are slugified (spaces → dashes: "north node.svg" →
// "north-node.svg") — a bare space in a Metro asset path reaches the native
// image loader mangled (URL-encoded oddly, `%2F` where a `/` belongs) and
// crashes rather than 404s (see the fix-round-1 note this line was added
// for). The require() path baked into glyph-map.gen.ts points at the
// slugified filename; only the exported KEY keeps the iOS name.
//
// Run: npm run sync-glyphs
//   (KAIROS_IOS_PATH overrides the default ../kairos-ios; inside a worktree
//   the default does not resolve — pass it explicitly.)

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, copyFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const IOS = process.env.KAIROS_IOS_PATH ?? join(ROOT, '..', 'kairos-ios');
const CATALOG = join(IOS, 'kairos-swift', 'Assets.xcassets', 'glyphs');
const OUT_ASSETS = join(ROOT, 'assets', 'chart-glyphs');
const OUT_MAP = join(ROOT, 'src', 'features', 'chart', 'render', 'glyph-map.gen.ts');

// The groups the chart renderer consumes (aspects/houses/rings subfolders are
// deliberately NOT synced — nothing renders them yet; sync them with the task
// that does). rx.imageset sits at the catalog root (iOS: "glyphs/rx").
const GROUPS = ['celestials', 'signs', 'other'];

function die(message) {
  // Fail loudly rather than emitting an empty map — a generator that silently
  // produces nothing leaves the wheel rendering blank (see sync-tokens.mjs).
  console.error(`sync-chart-glyphs: ${message}`);
  process.exit(1);
}

if (!existsSync(CATALOG)) {
  die(`glyph catalog not found at ${CATALOG}. Clone kairos-ios beside this repo, or set KAIROS_IOS_PATH.`);
}

let sourceCommit = 'unknown';
try {
  sourceCommit = execFileSync('git', ['-C', IOS, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
} catch {
  console.warn('sync-chart-glyphs: could not read kairos-ios HEAD; stamping "unknown"');
}

/** Filesystem-safe filename: spaces → dashes. Keys are NOT run through this — see header. */
function slugify(name) {
  return name.replace(/\s+/g, '-');
}

/** Collect "<key> -> <absolute svg path>" pairs. Key = asset name minus "glyphs/". */
function collect() {
  const entries = [];
  const take = (keyPrefix, imagesetDir) => {
    const name = imagesetDir.replace(/\.imageset$/, '');
    const dir = join(CATALOG, ...keyPrefix.split('/').filter(Boolean), imagesetDir);
    const svg = readdirSync(dir).find((f) => f.endsWith('.svg'));
    if (!svg) die(`${dir} contains no .svg — catalog drift; investigate before syncing.`);
    const key = keyPrefix ? `${keyPrefix}/${name}` : name;
    const fileName = slugify(name);
    entries.push({ key, name, fileName, group: keyPrefix, src: join(dir, svg) });
  };

  for (const group of GROUPS) {
    const groupDir = join(CATALOG, group);
    if (!existsSync(groupDir)) die(`expected group folder missing: ${groupDir}`);
    for (const entry of readdirSync(groupDir).sort()) {
      if (entry.endsWith('.imageset')) take(group, entry);
    }
  }
  // rx.imageset at the catalog root (group-less).
  const rx = 'rx.imageset';
  if (!existsSync(join(CATALOG, rx))) die(`expected ${join(CATALOG, rx)} — the retrograde glyph is load-bearing.`);
  take('', rx);

  return entries.sort((a, b) => a.key.localeCompare(b.key));
}

const entries = collect();
if (entries.length === 0) die(`no glyphs collected from ${CATALOG} — refusing to emit an empty map.`);

// assets/chart-glyphs is 100% generated — wipe and rewrite so a glyph removed
// upstream cannot linger here (stale generated output is invisible drift).
rmSync(OUT_ASSETS, { recursive: true, force: true });
const seenKeys = new Set();
const seenFiles = new Set(); // "<group>/<fileName>" — catches two names slugifying to the same file
for (const { key, fileName, group, src } of entries) {
  if (seenKeys.has(key)) die(`duplicate glyph key "${key}" — two imagesets share a name.`);
  seenKeys.add(key);
  const fileId = `${group}/${fileName}`;
  if (seenFiles.has(fileId)) die(`duplicate slugified filename "${fileId}" — two imageset names collide after slugifying.`);
  seenFiles.add(fileId);
  const destDir = group ? join(OUT_ASSETS, group) : OUT_ASSETS;
  mkdirSync(destDir, { recursive: true });
  copyFileSync(src, join(destDir, `${fileName}.svg`));
}

const requirePath = (entry) => {
  const rel = relative(dirname(OUT_MAP), join(OUT_ASSETS, entry.group, `${entry.fileName}.svg`));
  return rel.split('\\').join('/'); // windows-safe, stable diffs
};

const lines = entries
  .map((entry) => `  ${JSON.stringify(entry.key)}: require(${JSON.stringify(requirePath(entry))}),`)
  .join('\n');

const body = `// GENERATED by scripts/sync-chart-glyphs.mjs — do not edit by hand.
//
// Source: kairos-ios @ ${sourceCommit} (kairos-swift/Assets.xcassets/glyphs)
// Regenerate: npm run sync-glyphs
//
// The provenance line above is load-bearing: re-run the script and diff to
// answer "has this drifted?" (the daoUI tokens.gen.ts header argues the case).
//
// Keys mirror the iOS asset names minus the "glyphs/" prefix:
// "signs/aries", "celestials/north node" (spaces preserved in the KEY), "rx".
// The require() paths point at slugified filenames on disk (spaces → dashes,
// e.g. "north-node.svg") — a bare space in a Metro asset path reaches the
// native image loader mangled and crashes; only the key keeps the iOS name.
// Values are Metro asset modules (jest's assetFileTransformer stubs them).
// The SVGs use only Skia-supported features (plain paths/strokes/fills —
// verified against the SVG-support list at
// https://shopify.github.io/react-native-skia/docs/images-svg#svg-support).

export const KAIROS_IOS_SOURCE_COMMIT = ${JSON.stringify(sourceCommit)};

export const GLYPH_COUNT = ${entries.length};

export const GLYPH_ASSETS = {
${lines}
} as const;

export type GlyphName = keyof typeof GLYPH_ASSETS;
`;

mkdirSync(dirname(OUT_MAP), { recursive: true });
writeFileSync(OUT_MAP, body);

const counts = {};
for (const { group } of entries) counts[group || '(root)'] = (counts[group || '(root)'] ?? 0) + 1;
console.log(
  `sync-chart-glyphs: wrote ${entries.length} glyphs from kairos-ios @ ${sourceCommit}`,
);
for (const [group, count] of Object.entries(counts)) {
  console.log(`  ${group}: ${count}`);
}
