/**
 * Preset — the top-level wire blob — plus the four preset-level sub-blobs
 * that weren't ring-shaped enough for core-types.ts: AspectConfiguration,
 * FixedStarsConfiguration (+ StarSelection), SelectionStyleOverride.
 * (AspectOverlayStyle lives in ring-styles.ts and is imported here.)
 *
 * Mirrors (field names + defaults cross-checked 2026-08-14):
 *  - swift .../Presets/PresetWireFormat.swift (`PresetWireFormat`,
 *    `ChartConfigWireFormat`) ↔ crates/kairos-core/src/presets/preset.rs
 *    (`Preset`, `ChartConfig`, `AspectConfiguration`)
 *  - swift .../Presets/CodableTypes/FixedStarsConfiguration.swift +
 *    swift .../Support/StarSelection.swift
 *    ↔ crates/kairos-core/src/presets/content.rs
 *  - swift .../Presets/CodableTypes/SelectionStyleOverride.swift
 *    ↔ crates/kairos-core/src/presets/styles.rs (defaults identical)
 *  - Wire verified against fixtures/presets/*.json (byte-verbatim copies of
 *    KairosCore PresetTemplates @ 51b14188ea29b203d51bb4ef6a515e5af79390ef).
 *
 * Roundtrip policy (design ruling): parse → serialize drops unknown keys,
 * matching Swift's rewrite behavior (typed struct → re-encode loses the
 * unmapped). Deliberately dropped at this level: `authorDid`, `sourceUri`,
 * `createdAt`, `modifiedAt` (identity/timestamps belong to the vault-side
 * record, not the template). The gate is a parse FIXED POINT —
 * `parse(serialize(parse(j)))` deep-equals `parse(j)` — not byte equality.
 *
 * Tolerance contract: same as core-types.ts (never throws, defaults on the
 * malformed). `parsePreset({})` yields a fully-defaulted preset.
 */

import {
  parseChartColors,
  parseColorValue,
  parseGlobalChartVariables,
  parseVisibilityConfiguration,
  serializeChartColors,
  serializeColorValue,
  serializeGlobalChartVariables,
  serializeVisibilityConfiguration,
  CHART_COLORS_DEFAULT,
  GLOBAL_CHART_VARIABLES_DEFAULT,
  VISIBILITY_CONFIGURATION_DEFAULT,
  type ChartColors,
  type ColorValue,
  type GlobalChartVariables,
  type VisibilityConfiguration,
} from "./core-types";
import { bool, num, obj, str, strArr } from "./decode";
import {
  parseAspectOrbs,
  serializeAspectOrbs,
  ASPECT_ORBS_DEFAULT,
  type AspectOrbs,
} from "./ring-content";
import {
  parseRingModule,
  serializeRingModule,
  type RingModule,
} from "./ring-module";
import {
  parseAspectOverlayStyle,
  serializeAspectOverlayStyle,
  ASPECT_OVERLAY_STYLE_DEFAULT,
  type AspectOverlayStyle,
} from "./ring-styles";

// =============================================================================
// AspectConfiguration
// =============================================================================

/**
 * Preset-level aspect configuration: which aspect types are on, their orbs,
 * the grid toggle, and the Stage 3.7 filter flags.
 *
 * Wire (camelCase; verified in classic.json `/aspects`, 2026-08-14):
 *   { "enabledTypes": ["Trine", ...], "enabled": true,
 *     "orbs": { "orbs": { "Conjunction": 8, ... } }, "showGrid": true,
 *     "showSeparatingAspects": true, "showFalseAspects": false,
 *     "mutualAspectsOnly": true, "interAspectsOnly": true,
 *     "filterBySelection": true }
 *
 * `enabledTypes` values are PascalCase AspectType raw values ("Conjunction"…).
 * Unknown strings pass through tolerantly (Swift's synthesized array decode
 * would throw the whole blob on an unknown raw value; Preset.aspects catches
 * with `try?` → whole-default — this mirror keeps the good fields instead).
 *
 * `orbs` is the nested `{ orbs: {...} }` shape — parsed by the shared
 * `parseAspectOrbs` from ring-content.ts (same blob the aspects ring uses).
 *
 * `enabled` is the overlay master switch, decoupled from `enabledTypes` so a
 * toggle cycle preserves the per-type selection (render gate:
 * `enabled && !enabledTypes.isEmpty`). Legacy fallback when the key is absent
 * (pre-3.7 backups): `enabled = !enabledTypes.isEmpty`, per the Swift decoder.
 *
 * DRIFT RECORD (2026-08-14 — Swift wins, same precedent as
 * VisibilityConfiguration): Rust `preset.rs` `AspectConfiguration` has NO
 * `enabled` field (nor do its doc comments on the Swift file's stale header
 * block, which predates Stage 3.7). Swift added it in Stage 3.7 with a
 * decodeIfPresent fallback, and all seven bundled templates carry it. Rust
 * reads tolerantly (serde ignores the unknown key) and would drop it on
 * rewrite; this mirror preserves it. Wire-compatible both directions.
 */
export interface AspectConfiguration {
  /** Swift-compatible visibility flag; absent in older documents. */
  showPatterns?: boolean;
  /** Additive pattern preferences, independent of ordinary aspect orbs. */
  patterns?: { enabledTypes: string[]; orb: number };
  enabledTypes: string[];
  enabled: boolean;
  orbs: AspectOrbs;
  showGrid: boolean;
  showSeparatingAspects: boolean;
  showFalseAspects: boolean;
  mutualAspectsOnly: boolean;
  interAspectsOnly: boolean;
  filterBySelection: boolean;
}

/** Swift `AspectConfiguration.default`: the five Ptolemaic majors + grid on. */
export const ASPECT_CONFIGURATION_DEFAULT: AspectConfiguration = {
  enabledTypes: ["Conjunction", "Opposition", "Trine", "Square", "Sextile"],
  enabled: true, // derived: !enabledTypes.isEmpty on the default type list
  orbs: ASPECT_ORBS_DEFAULT,
  showGrid: true,
  showSeparatingAspects: true,
  showFalseAspects: true,
  mutualAspectsOnly: false,
  interAspectsOnly: false,
  filterBySelection: false,
};

export function parseAspectConfiguration(v: unknown): AspectConfiguration {
  const o = obj(v);
  const d = ASPECT_CONFIGURATION_DEFAULT;
  const enabledTypes = strArr(o.enabledTypes, d.enabledTypes);
  return {
    enabledTypes,
    ...(typeof o.showPatterns === 'boolean' ? { showPatterns: o.showPatterns } : {}),
    ...(o.patterns && typeof o.patterns === 'object' ? { patterns: {
      enabledTypes: strArr(obj(o.patterns).enabledTypes, []),
      orb: Math.max(0, Math.min(15, num(obj(o.patterns).orb, 5))),
    } } : {}),
    // Swift: decodeIfPresent(Bool) ?? !enabledTypes.isEmpty (legacy semantic).
    enabled: bool(o.enabled, enabledTypes.length > 0),
    orbs: parseAspectOrbs(o.orbs),
    showGrid: bool(o.showGrid, d.showGrid),
    showSeparatingAspects: bool(o.showSeparatingAspects, d.showSeparatingAspects),
    showFalseAspects: bool(o.showFalseAspects, d.showFalseAspects),
    mutualAspectsOnly: bool(o.mutualAspectsOnly, d.mutualAspectsOnly),
    interAspectsOnly: bool(o.interAspectsOnly, d.interAspectsOnly),
    filterBySelection: bool(o.filterBySelection, d.filterBySelection),
  };
}

/** Serialize in Swift's CodingKeys order. */
export function serializeAspectConfiguration(a: AspectConfiguration): unknown {
  return {
    enabledTypes: [...a.enabledTypes],
    ...(a.showPatterns !== undefined ? { showPatterns: a.showPatterns } : {}),
    ...(a.patterns ? { patterns: { ...a.patterns, enabledTypes: [...a.patterns.enabledTypes] } } : {}),
    enabled: a.enabled,
    orbs: serializeAspectOrbs(a.orbs),
    showGrid: a.showGrid,
    showSeparatingAspects: a.showSeparatingAspects,
    showFalseAspects: a.showFalseAspects,
    mutualAspectsOnly: a.mutualAspectsOnly,
    interAspectsOnly: a.interAspectsOnly,
    filterBySelection: a.filterBySelection,
  };
}

// =============================================================================
// StarSelection + FixedStarsConfiguration
// =============================================================================

/**
 * One user-selected fixed star.
 *
 * Wire (camelCase; verified in classic.json `/fixedStars/selectedStars[0]`):
 *   { "name": "Regulus", "displayDesignation": "α Leo", "magnitude": 1.4,
 *     "constellation": "Leo", "sign": "Leo", "degrees": 29, "minutes": 49 }
 *
 * `name` is the sefstars.txt lookup key (swe_fixstar); `degrees`/`minutes`
 * are the position within `sign` (ints on Swift; tolerated as any finite
 * number here).
 *
 * DRIFT RECORD (2026-08-14 — Swift wins): Rust `content.rs` `StarSelection`
 * is a 4-field struct (name, display_designation, magnitude, constellation)
 * with NO sign/degrees/minutes. Swift added those three with backward-compat
 * decode defaults (""/0/0), and the bundled templates carry all seven fields.
 * This mirror follows Swift; Rust reads the extra keys tolerantly.
 * (Swift also throws on a MISSING name/displayDesignation/magnitude/
 * constellation — synthesized `decode`, not `decodeIfPresent`; this mirror
 * defaults instead, per the tolerance contract.)
 */
export interface StarSelection {
  name: string;
  displayDesignation: string;
  magnitude: number;
  constellation: string;
  sign: string;
  degrees: number;
  minutes: number;
}

export const STAR_SELECTION_DEFAULT: StarSelection = {
  name: "",
  displayDesignation: "",
  magnitude: 0,
  constellation: "",
  sign: "",
  degrees: 0,
  minutes: 0,
};

export function parseStarSelection(v: unknown): StarSelection {
  const o = obj(v);
  const d = STAR_SELECTION_DEFAULT;
  return {
    name: str(o.name, d.name),
    displayDesignation: str(o.displayDesignation, d.displayDesignation),
    magnitude: num(o.magnitude, d.magnitude),
    constellation: str(o.constellation, d.constellation),
    sign: str(o.sign, d.sign),
    degrees: num(o.degrees, d.degrees),
    minutes: num(o.minutes, d.minutes),
  };
}

export function serializeStarSelection(s: StarSelection): unknown {
  return {
    name: s.name,
    displayDesignation: s.displayDesignation,
    magnitude: s.magnitude,
    constellation: s.constellation,
    sign: s.sign,
    degrees: s.degrees,
    minutes: s.minutes,
  };
}

/**
 * Preset-level fixed-stars configuration: the curated library + display
 * flags. Preset-level (not per-ring) so the library survives temporary
 * fixed-stars-ring removal and is editable independent of ring presence.
 *
 * Wire (camelCase): `{ "selectedStars": [StarSelection...], "showDegrees":
 * true, "showSign": false, "showMinutes": false }` — Swift/Rust defaults
 * identical (`selectedStars []`, showDegrees true, showSign/showMinutes false).
 *
 * Tolerance: a non-array `selectedStars` falls back to `[]`; malformed
 * (non-object) elements are DROPPED rather than defaulted — the non-throwing
 * mirror of Swift's throw-on-malformed-element (a fabricated empty star named
 * "" would be worse than losing the entry).
 */
export interface FixedStarsConfiguration {
  selectedStars: StarSelection[];
  showDegrees: boolean;
  showSign: boolean;
  showMinutes: boolean;
}

export const FIXED_STARS_CONFIGURATION_DEFAULT: FixedStarsConfiguration = {
  selectedStars: [],
  showDegrees: true,
  showSign: false,
  showMinutes: false,
};

export function parseFixedStarsConfiguration(v: unknown): FixedStarsConfiguration {
  const o = obj(v);
  const d = FIXED_STARS_CONFIGURATION_DEFAULT;
  const raw = o.selectedStars;
  return {
    selectedStars: Array.isArray(raw)
      ? raw
          .filter((e) => typeof e === "object" && e !== null && !Array.isArray(e))
          .map(parseStarSelection)
      : [...d.selectedStars],
    showDegrees: bool(o.showDegrees, d.showDegrees),
    showSign: bool(o.showSign, d.showSign),
    showMinutes: bool(o.showMinutes, d.showMinutes),
  };
}

export function serializeFixedStarsConfiguration(c: FixedStarsConfiguration): unknown {
  return {
    selectedStars: c.selectedStars.map(serializeStarSelection),
    showDegrees: c.showDegrees,
    showSign: c.showSign,
    showMinutes: c.showMinutes,
  };
}

// =============================================================================
// SelectionStyleOverride
// =============================================================================

/**
 * Style overrides for selected/unselected/related node states.
 *
 * Wire: camelCase per Stage 3.5 D10 (verified in classic.json `/selection`).
 * Swift decoder is fully tolerant (decodeIfPresent ?? .default per field) —
 * this mirror matches. Defaults are Swift `SelectionStyleOverride.default`;
 * Rust `SelectionStyleOverride::default()` is IDENTICAL (cross-checked
 * 2026-08-14, styles.rs:690 — no drift). 15 fields, Stage 3.6 included.
 */
export interface SelectionStyleOverride {
  // Colors
  selectedColor: ColorValue;
  unselectedColor: ColorValue;
  /** 0.0–1.0; default 0.4. */
  unselectedOpacity: number;
  /** Related-tier (aspected, conjunct fixed stars) opacity; default 1.0. */
  relatedOpacity: number;
  // Related-tier population (Stage 3.6)
  includeAspectedPlanets: boolean;
  includeConjunctFixedStars: boolean;
  /** Degrees; default 5.0. */
  conjunctFixedStarsOrb: number;
  includeRulershipPlanets: boolean;
  // Ring exclusions (Stage 3.6)
  ignoreZodiacRingOpacity: boolean;
  // Apply to
  affectsGlyphs: boolean;
  affectsDegreeText: boolean;
  affectsDegreeMarks: boolean;
  affectsHouseNumbers: boolean;
  affectsCuspLines: boolean;
  // Visual feedback (Stage 3.6)
  showBackgroundCircle: boolean;
}

export const SELECTION_STYLE_OVERRIDE_DEFAULT: SelectionStyleOverride = {
  selectedColor: { source: "semantic", value: "accent", layer: "primitive" },
  unselectedColor: { source: "semantic", value: "secondary", layer: "primitive" },
  unselectedOpacity: 0.4,
  relatedOpacity: 1.0,
  includeAspectedPlanets: false,
  includeConjunctFixedStars: false,
  conjunctFixedStarsOrb: 5.0,
  includeRulershipPlanets: false,
  ignoreZodiacRingOpacity: false,
  affectsGlyphs: true,
  affectsDegreeText: true,
  affectsDegreeMarks: true,
  affectsHouseNumbers: true,
  affectsCuspLines: true,
  showBackgroundCircle: false,
};

export function parseSelectionStyleOverride(v: unknown): SelectionStyleOverride {
  const o = obj(v);
  const d = SELECTION_STYLE_OVERRIDE_DEFAULT;
  // ColorValue fields follow the parseAspectOverlayStyle.monochromeColor
  // pattern: absent/null → the selection-specific default (parseColorValue's
  // own missing-key default is COLOR_VALUE_DEFAULT, the wrong one here).
  const color = (key: "selectedColor" | "unselectedColor"): ColorValue =>
    o[key] === undefined || o[key] === null ? { ...d[key] } : parseColorValue(o[key]);
  return {
    selectedColor: color("selectedColor"),
    unselectedColor: color("unselectedColor"),
    unselectedOpacity: num(o.unselectedOpacity, d.unselectedOpacity),
    relatedOpacity: num(o.relatedOpacity, d.relatedOpacity),
    includeAspectedPlanets: bool(o.includeAspectedPlanets, d.includeAspectedPlanets),
    includeConjunctFixedStars: bool(o.includeConjunctFixedStars, d.includeConjunctFixedStars),
    conjunctFixedStarsOrb: num(o.conjunctFixedStarsOrb, d.conjunctFixedStarsOrb),
    includeRulershipPlanets: bool(o.includeRulershipPlanets, d.includeRulershipPlanets),
    ignoreZodiacRingOpacity: bool(o.ignoreZodiacRingOpacity, d.ignoreZodiacRingOpacity),
    affectsGlyphs: bool(o.affectsGlyphs, d.affectsGlyphs),
    affectsDegreeText: bool(o.affectsDegreeText, d.affectsDegreeText),
    affectsDegreeMarks: bool(o.affectsDegreeMarks, d.affectsDegreeMarks),
    affectsHouseNumbers: bool(o.affectsHouseNumbers, d.affectsHouseNumbers),
    affectsCuspLines: bool(o.affectsCuspLines, d.affectsCuspLines),
    showBackgroundCircle: bool(o.showBackgroundCircle, d.showBackgroundCircle),
  };
}

export function serializeSelectionStyleOverride(s: SelectionStyleOverride): unknown {
  return {
    selectedColor: serializeColorValue(s.selectedColor),
    unselectedColor: serializeColorValue(s.unselectedColor),
    unselectedOpacity: s.unselectedOpacity,
    relatedOpacity: s.relatedOpacity,
    includeAspectedPlanets: s.includeAspectedPlanets,
    includeConjunctFixedStars: s.includeConjunctFixedStars,
    conjunctFixedStarsOrb: s.conjunctFixedStarsOrb,
    includeRulershipPlanets: s.includeRulershipPlanets,
    ignoreZodiacRingOpacity: s.ignoreZodiacRingOpacity,
    affectsGlyphs: s.affectsGlyphs,
    affectsDegreeText: s.affectsDegreeText,
    affectsDegreeMarks: s.affectsDegreeMarks,
    affectsHouseNumbers: s.affectsHouseNumbers,
    affectsCuspLines: s.affectsCuspLines,
    showBackgroundCircle: s.showBackgroundCircle,
  };
}

// =============================================================================
// ChartConfigSlot
// =============================================================================

/**
 * One chart-count slot (solo/dual/triple): the rings for that variant plus
 * the shared canvas layout variables. Mirrors Rust `ChartConfig` / Swift
 * `ChartConfigWireFormat`. `rings` order is visual order, OUTERMOST-first
 * (there is no sortOrder on the wire; index is position). Verified
 * 2026-08-14 (Task 7): iOS `RingGeometry` renders index 0 at the outer
 * radius, both configuration builders append in slot order, and the bundled
 * templates lead with the zodiac band (classic solo: zodiac → planets →
 * houses). The KairosCore entity comments ("innermost = 0 → outermost" on
 * `RingModuleEntity.sortOrder` / `ChartConfigEntity.sortedRings`) are
 * mislabeled — sortOrder is assigned from the wire index, which is outermost.
 *
 * Wire: `{ "globalSettings": {...}, "rings": [...] }` (camelCase).
 */
export interface ChartConfigSlot {
  globalSettings: GlobalChartVariables;
  rings: RingModule[];
}

export const CHART_CONFIG_SLOT_DEFAULT: ChartConfigSlot = {
  globalSettings: GLOBAL_CHART_VARIABLES_DEFAULT,
  rings: [],
};

export function parseChartConfigSlot(v: unknown): ChartConfigSlot {
  const o = obj(v);
  return {
    globalSettings: parseGlobalChartVariables(o.globalSettings),
    rings: Array.isArray(o.rings) ? o.rings.map(parseRingModule) : [],
  };
}

export function serializeChartConfigSlot(c: ChartConfigSlot): unknown {
  return {
    globalSettings: serializeGlobalChartVariables(c.globalSettings),
    rings: c.rings.map(serializeRingModule),
  };
}

// =============================================================================
// Preset
// =============================================================================

/**
 * The preset wire blob.
 *
 * Wire (camelCase; top-level keys of fixtures/presets/*.json): id (UUID
 * string, passed through unvalidated), name, description, colors, selection,
 * aspects, aspectOverlay, fixedStars, visibility, soloChart, dualChart,
 * tripleChart, sourceTemplateName?, sourceTemplateVersion?. Absent on the
 * wire and deliberately unmapped here: authorDid, sourceUri, createdAt,
 * modifiedAt (see the roundtrip policy at the top of this file).
 *
 * `sourceTemplateName`/`sourceTemplateVersion` are the bundled-template
 * lineage pair — `null` when absent, and OMITTED (not null) on serialize,
 * matching Swift `encodeIfPresent` / Rust `skip_serializing_if`.
 *
 * `aspectOverlay` is the preset-level AspectOverlayStyle — the SAME shape as
 * the aspects ring style but BARE on the wire (no `$type` tag; verified in
 * classic.json `/aspectOverlay`). The in-memory value still carries `$type`
 * (the shared parser attaches it); the serializer strips it.
 */
export interface Preset {
  id: string;
  name: string;
  description: string;
  sourceTemplateName: string | null;
  sourceTemplateVersion: number | null;
  soloChart: ChartConfigSlot;
  dualChart: ChartConfigSlot;
  tripleChart: ChartConfigSlot;
  colors: ChartColors;
  aspects: AspectConfiguration;
  aspectOverlay: AspectOverlayStyle;
  fixedStars: FixedStarsConfiguration;
  selection: SelectionStyleOverride;
  visibility: VisibilityConfiguration;
}

export const PRESET_DEFAULT: Preset = {
  id: "",
  name: "",
  description: "",
  sourceTemplateName: null,
  sourceTemplateVersion: null,
  soloChart: CHART_CONFIG_SLOT_DEFAULT,
  dualChart: CHART_CONFIG_SLOT_DEFAULT,
  tripleChart: CHART_CONFIG_SLOT_DEFAULT,
  colors: CHART_COLORS_DEFAULT,
  aspects: ASPECT_CONFIGURATION_DEFAULT,
  aspectOverlay: ASPECT_OVERLAY_STYLE_DEFAULT,
  fixedStars: FIXED_STARS_CONFIGURATION_DEFAULT,
  selection: SELECTION_STYLE_OVERRIDE_DEFAULT,
  visibility: VISIBILITY_CONFIGURATION_DEFAULT,
};

function optStr(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

function optNum(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * Preset-level aspectOverlay is bare on the wire: same fields as the ring
 * style, minus the `$type` discriminant (see the note on `Preset`).
 */
function serializePresetAspectOverlay(s: AspectOverlayStyle): unknown {
  const { $type: _dropped, ...bare } = obj(serializeAspectOverlayStyle(s));
  return bare;
}

/**
 * Tolerant preset parse — never throws; `{}` yields PRESET_DEFAULT values.
 * Unknown keys (createdAt, modifiedAt, authorDid, sourceUri, anything else)
 * are dropped, matching Swift's typed-struct rewrite.
 */
export function parsePreset(v: unknown): Preset {
  const o = obj(v);
  return {
    id: str(o.id, PRESET_DEFAULT.id),
    name: str(o.name, PRESET_DEFAULT.name),
    description: str(o.description, PRESET_DEFAULT.description),
    sourceTemplateName: optStr(o.sourceTemplateName),
    sourceTemplateVersion: optNum(o.sourceTemplateVersion),
    soloChart: parseChartConfigSlot(o.soloChart),
    dualChart: parseChartConfigSlot(o.dualChart),
    tripleChart: parseChartConfigSlot(o.tripleChart),
    colors: parseChartColors(o.colors),
    aspects: parseAspectConfiguration(o.aspects),
    aspectOverlay: parseAspectOverlayStyle(o.aspectOverlay),
    fixedStars: parseFixedStarsConfiguration(o.fixedStars),
    selection: parseSelectionStyleOverride(o.selection),
    visibility: parseVisibilityConfiguration(o.visibility),
  };
}

/** Serialize in Swift `PresetWireFormat` field order (minus the dropped keys). */
export function serializePreset(p: Preset): unknown {
  const out: Record<string, unknown> = {
    id: p.id,
    name: p.name,
    description: p.description,
    colors: serializeChartColors(p.colors),
    selection: serializeSelectionStyleOverride(p.selection),
    aspects: serializeAspectConfiguration(p.aspects),
    aspectOverlay: serializePresetAspectOverlay(p.aspectOverlay),
    fixedStars: serializeFixedStarsConfiguration(p.fixedStars),
    visibility: serializeVisibilityConfiguration(p.visibility),
    soloChart: serializeChartConfigSlot(p.soloChart),
    dualChart: serializeChartConfigSlot(p.dualChart),
    tripleChart: serializeChartConfigSlot(p.tripleChart),
  };
  if (p.sourceTemplateName !== null) out.sourceTemplateName = p.sourceTemplateName;
  if (p.sourceTemplateVersion !== null) out.sourceTemplateVersion = p.sourceTemplateVersion;
  return out;
}
