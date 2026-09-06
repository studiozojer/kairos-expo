/**
 * Roundtrip gate for the preset schema (Task 4).
 *
 * Policy (design ruling): parse → serialize drops unknown keys, matching
 * Swift's rewrite behavior (the Swift blobs decode into typed structs and
 * re-encode, losing anything unmapped). The gate is therefore a parse
 * FIXED POINT — `parse(serialize(parse(j)))` deep-equals `parse(j)` — NOT
 * byte equality with the original file.
 *
 * The seven fixtures are byte-verbatim copies of KairosCore's bundled
 * PresetTemplates (see fixtures/presets/README.md); the provenance guard
 * below pins each file's SHA-256 so the copies stay verbatim.
 */

import { createHash } from "crypto";
import { readFileSync } from "fs";

import classic from "../../fixtures/presets/classic.json";
import minimal from "../../fixtures/presets/minimal.json";
import modern from "../../fixtures/presets/modern.json";
import starfield from "../../fixtures/presets/starfield.json";
import study from "../../fixtures/presets/study.json";
import traditional from "../../fixtures/presets/traditional.json";
import transits from "../../fixtures/presets/transits.json";
import {
  ASPECT_CONFIGURATION_DEFAULT,
  FIXED_STARS_CONFIGURATION_DEFAULT,
  SELECTION_STYLE_OVERRIDE_DEFAULT,
  parsePreset,
  serializePreset,
} from "../preset";
import { ASPECT_OVERLAY_STYLE_DEFAULT } from "../ring-styles";

const ALL_TEMPLATES = [
  { name: "classic", json: classic },
  { name: "minimal", json: minimal },
  { name: "modern", json: modern },
  { name: "starfield", json: starfield },
  { name: "study", json: study },
  { name: "traditional", json: traditional },
  { name: "transits", json: transits },
];

// ---------------------------------------------------------------------------
// The gate: every bundled template parses and reaches a serialization
// fixed point. One test per template so a regression names its template.
// ---------------------------------------------------------------------------

test.each(ALL_TEMPLATES)("$name parses and reaches a serialization fixed point", ({ json }) => {
  const p1 = parsePreset(json);
  const p2 = parsePreset(serializePreset(p1));
  expect(p2).toEqual(p1);
});

test("classic solo slot has ordered enabled rings", () => {
  const p = parsePreset(classic);
  expect(p.soloChart.rings.length).toBeGreaterThan(0);
  expect(p.soloChart.rings.some((r) => r.type === "planets" && r.enabled)).toBe(true);
});

test("empty object degrades to a fully-defaulted preset, silently", () => {
  expect(() => parsePreset({})).not.toThrow();
});

// ---------------------------------------------------------------------------
// Default-degradation spot checks: {} must produce the Swift defaults, and
// the defaulted preset must itself sit at the fixed point.
// ---------------------------------------------------------------------------

test("empty object yields Swift defaults for the preset-level blobs", () => {
  const p = parsePreset({});
  expect(p.id).toBe("");
  expect(p.name).toBe("");
  expect(p.description).toBe("");
  expect(p.sourceTemplateName).toBeNull();
  expect(p.sourceTemplateVersion).toBeNull();
  expect(p.soloChart.rings).toEqual([]);
  expect(p.aspects).toEqual(ASPECT_CONFIGURATION_DEFAULT);
  // Default aspects blob: legacy semantic derives enabled from non-empty types.
  expect(p.aspects.enabled).toBe(true);
  expect(p.aspectOverlay).toEqual(ASPECT_OVERLAY_STYLE_DEFAULT);
  expect(p.fixedStars).toEqual(FIXED_STARS_CONFIGURATION_DEFAULT);
  expect(p.selection).toEqual(SELECTION_STYLE_OVERRIDE_DEFAULT);
  expect(p.visibility.enabledBodies).toEqual([]);
  expect(parsePreset(serializePreset(p))).toEqual(p);
});

test("classic aspects blob parses the Stage 3.7 fields", () => {
  const p = parsePreset(classic);
  expect(p.aspects.enabled).toBe(true);
  expect(p.aspects.enabledTypes).toContain("Quincunx");
  expect(p.aspects.orbs.orbs.Square).toBe(8);
  expect(p.aspects.filterBySelection).toBe(true);
  expect(p.aspects.interAspectsOnly).toBe(true);
});

test("preset-level aspectOverlay round-trips bare (no $type on the wire)", () => {
  const p = parsePreset(classic);
  const wire = serializePreset(p) as Record<string, unknown>;
  const overlay = wire.aspectOverlay as Record<string, unknown>;
  expect(overlay).toBeDefined();
  expect(overlay.$type).toBeUndefined();
  // ...while the parsed in-memory form still carries the ring-style tag.
  expect(p.aspectOverlay.$type).toBeDefined();
});

test("maximumAspectCount 0 survives (0 = unlimited, a real value — not a default)", () => {
  const p = parsePreset(classic);
  expect(p.aspectOverlay.maximumAspectCount).toBe(0);
});

test("classic fixedStars seeds the royal stars with per-star positions", () => {
  const p = parsePreset(classic);
  expect(p.fixedStars.selectedStars.length).toBeGreaterThanOrEqual(4);
  const regulus = p.fixedStars.selectedStars.find((s) => s.name === "Regulus");
  expect(regulus).toMatchObject({
    displayDesignation: "α Leo",
    constellation: "Leo",
    sign: "Leo",
    degrees: 29,
    minutes: 49,
  });
});

test("classic selection parses (incl. the float-funny unselectedOpacity)", () => {
  const p = parsePreset(classic);
  expect(p.selection.selectedColor).toEqual({
    source: "semantic",
    value: "accent",
    layer: "primitive",
  });
  expect(p.selection.unselectedOpacity).toBeCloseTo(0.2, 10);
});

test("classic visibility carries display names through untouched", () => {
  const p = parsePreset(classic);
  expect(p.visibility.enabledBodies).toContain("North Node");
  expect(p.visibility.enabledBodies).toContain("Imum Coeli");
});

test("lineage fields parse; nulls are omitted (not null) on serialize", () => {
  const p = parsePreset(classic);
  expect(p.sourceTemplateName).toBe("classic");
  expect(p.sourceTemplateVersion).toBe(4);
  const wire = serializePreset(parsePreset({})) as Record<string, unknown>;
  expect("sourceTemplateName" in wire).toBe(false);
  expect("sourceTemplateVersion" in wire).toBe(false);
});

// ---------------------------------------------------------------------------
// Provenance guard: the fixture copies must stay byte-identical to the
// KairosCore templates recorded in fixtures/presets/README.md.
// ---------------------------------------------------------------------------

const EXPECTED_SHA256: Record<string, string> = {
  "classic.json": "7eaa435232d869d631fabe897f7fa0fdb5b08818a1865a49170816a44c37cdbb",
  "minimal.json": "8ab456e683f1187c3cac05ff5c6bee5ce059d38fc31b68889505a0abf15d6d9b",
  "modern.json": "f7cca72f4c011117e9be5ac82e0748afa5dcd258c3b37d6447b7fe3bba1a05c7",
  "starfield.json": "d9eaac929cdbd5c6e16b26d93b422a1901c9b70b3c11068f2c228700011f14c0",
  "study.json": "878eca5728d11c57427becdbe10a857fe1876c86efd15a7af4a892c309c5f621",
  "traditional.json": "3213d4f89658ea5575ebadbd0c795b79316dd8c72557470567feb8ee681ed2a6",
  "transits.json": "4e2a29f264e5215db7df66d12ae768d7a5825714e781018d66cf76f626ee131a",
};

test.each(Object.entries(EXPECTED_SHA256))(
  "fixture %s is byte-identical to the KairosCore template (sha256)",
  (file, expected) => {
    const bytes = readFileSync(`${__dirname}/../../fixtures/presets/${file}`);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(expected);
  },
);
