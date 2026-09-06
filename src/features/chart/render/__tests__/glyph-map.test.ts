/**
 * glyph-map.gen.ts regression (Task 9 fix round 1, finding 1) — a bare space
 * in a Metro asset require() path reaches the native fetch mangled and
 * crashes rather than 404s (ENOENT `scandir` on a `%2F`-mangled URL). Five
 * generated assets ("imum coeli", "lot of soul", "north node", "part of
 * fortune", "south node") had space-containing filenames on disk;
 * sync-chart-glyphs.mjs now slugifies COPIED FILENAMES (spaces → dashes)
 * while keeping the exported KEYS at the iOS-name convention consumers key
 * by. This is a static check on the committed generated output — it does
 * not re-run the generator (that needs kairos-ios on disk, see the script's
 * header), it just pins the invariant so the space-in-filename bug can't
 * silently return on a future re-sync.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { GLYPH_ASSETS } from "../glyph-map.gen";

const GEN_FILE = join(__dirname, "..", "glyph-map.gen.ts");

test("no require() path in the generated map contains a literal space", () => {
  const source = readFileSync(GEN_FILE, "utf8");
  const requireCalls = [...source.matchAll(/require\(("(?:[^"\\]|\\.)*")\)/g)].map((m) => m[1]);
  expect(requireCalls.length).toBeGreaterThan(0); // sanity: the regex actually matched something
  const withSpaces = requireCalls.filter((call) => call.includes(" "));
  expect(withSpaces).toEqual([]);
});

test("keys keep the iOS space-containing names (the convention consumers key by)", () => {
  const spaceKeys = Object.keys(GLYPH_ASSETS).filter((k) => k.includes(" "));
  // At least the five known space-named celestials survive as keys.
  expect(spaceKeys).toEqual(
    expect.arrayContaining([
      "celestials/imum coeli",
      "celestials/lot of soul",
      "celestials/north node",
      "celestials/part of fortune",
      "celestials/south node",
    ]),
  );
});
