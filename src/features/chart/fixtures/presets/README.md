# Preset template fixtures

Byte-for-byte copies of the seven bundled KairosCore preset templates. They are
the wire-format ground truth for `src/features/chart/schema/preset.ts` and the
roundtrip gate in `schema/__tests__/preset-roundtrip.test.ts` (which pins the
SHA-256 of each file, so any edit here fails the suite).

- **Source:** `kairos-engine` repo, `swift/KairosCore/Sources/KairosCore/Resources/PresetTemplates/`
  (local checkout: `/Users/benatky/armillary/repos/kairos-engine`)
- **KairosCore commit:** `51b14188ea29b203d51bb4ef6a515e5af79390ef`
  (`git -C <kairos-engine> log -1 --format=%H -- swift/KairosCore/Sources/KairosCore/Resources/PresetTemplates`)
- **Copied:** 2026-08-14, Task 4 (chart-wheel-foundation). Never edit by hand;
  re-copy from the source path and update this note + the test hashes.

SHA-256 at copy time (verified byte-identical via `diff -r`):

| file             | sha256                                                             |
| ---------------- | ------------------------------------------------------------------ |
| classic.json     | 7eaa435232d869d631fabe897f7fa0fdb5b08818a1865a49170816a44c37cdbb   |
| minimal.json     | 8ab456e683f1187c3cac05ff5c6bee5ce059d38fc31b68889505a0abf15d6d9b   |
| modern.json      | f7cca72f4c011117e9be5ac82e0748afa5dcd258c3b37d6447b7fe3bba1a05c7   |
| starfield.json   | d9eaac929cdbd5c6e16b26d93b422a1901c9b70b3c11068f2c228700011f14c0   |
| study.json       | 878eca5728d11c57427becdbe10a857fe1876c86efd15a7af4a892c309c5f621   |
| traditional.json | 3213d4f89658ea5575ebadbd0c795b79316dd8c72557470567feb8ee681ed2a6   |
| transits.json    | 4e2a29f264e5215db7df66d12ae768d7a5825714e781018d66cf76f626ee131a   |

Note: these are template snapshots, not the full preset wire — Swift/Rust also
carry `authorDid` / `sourceUri` / `createdAt` / `modifiedAt`, which
`parsePreset` deliberately drops (the roundtrip policy is a parse fixed point,
not byte equality).
