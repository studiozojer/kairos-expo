/**
 * Ring content union — `$type`-discriminated, one variant per ring type.
 *
 * Mirrors (field names + defaults cross-checked 2026-08-14):
 *  - swift/KairosCore/Sources/KairosCore/Presets/CodableTypes/RingContent.swift
 *    (the `$type` TypeID constants + dispatch; Stage-3 legacy 4 cases carry
 *    inline fields, Stage-3.5 six wrap dedicated `*Content` structs)
 *  - swift .../CodableTypes/{DecansContent,SignRulersContent,TermsContent,
 *    LunarMansionsContent,FixedStarsContent,CuspAnnotationsContent}.swift
 *  - swift .../CodableTypes/AspectConfiguration.swift (AspectOrbs)
 *  - swift .../Engine/DTOs/ChartEnums.swift (HouseSystem raw values)
 *  - kairos-engine crates/kairos-core/src/presets/content.rs + enums.rs
 *
 * Wire shape: flat JSON object, `$type` NSID discriminator + camelCase
 * content fields. All ten variants PARSE even though only five render.
 *
 * Tolerance contract: same as core-types.ts — missing/malformed fields fall
 * back to defaults; parsing never throws. Note Swift's decoder is STRICT for
 * the legacy 4 inline cases (`try c.decode(...)`, not decodeIfPresent): a
 * missing key fails the whole blob there, and `RingModule.from(_:)` then
 * substitutes the ring type's default content. This mirror is deliberately
 * per-field tolerant (the documented convention), which is strictly more
 * forgiving and agrees on every well-formed blob.
 *
 * Ring-type fallback defaults come from Swift `defaultStyleAndContent(for:)`
 * (RingModule.swift:174) — Rust `RingModule::zodiac()/planets()/houses()`
 * agree on the legacy three; the aspects default is Swift-only (Rust has no
 * aspects ring constructor).
 *
 * DRIFT RECORD (2026-08-14, Swift wins per the standing Task-2 ruling — see
 * ring-styles.ts): `AspectOrbs.default` Square orb is **7.0** in Swift
 * (AspectConfiguration.swift:47) vs **8.0** in Rust (`AspectType::default_orb`,
 * types/edges.rs:73). The Rust value is read-time fallback only
 * (`AspectOrbs.get_orb`), never decode behavior. This mirror uses 7.0.
 */

import { bool, obj, oneOf, strArr } from "./decode";

// ---------------------------------------------------------------------------
// $type discriminator NSIDs (verbatim from RingContent.swift TypeID, :82-93)
// ---------------------------------------------------------------------------

export const ZODIAC_CONTENT_TYPE = "solar.kairos.preset.ring.content.zodiac";
export const PLANETS_CONTENT_TYPE = "solar.kairos.preset.ring.content.planets";
export const HOUSES_CONTENT_TYPE = "solar.kairos.preset.ring.content.houses";
export const ASPECTS_CONTENT_TYPE = "solar.kairos.preset.ring.content.aspects";
export const DECANS_CONTENT_TYPE = "solar.kairos.preset.ring.content.decans";
export const SIGN_RULERS_CONTENT_TYPE = "solar.kairos.preset.ring.content.signRulers";
export const TERMS_CONTENT_TYPE = "solar.kairos.preset.ring.content.terms";
export const LUNAR_MANSIONS_CONTENT_TYPE = "solar.kairos.preset.ring.content.lunarMansions";
export const FIXED_STARS_CONTENT_TYPE = "solar.kairos.preset.ring.content.fixedStars";
export const CUSP_ANNOTATIONS_CONTENT_TYPE =
  "solar.kairos.preset.ring.content.cuspAnnotations";

// ---------------------------------------------------------------------------
// Enums (wire value spaces; tolerant coercion falls back to the default)
// ---------------------------------------------------------------------------

/** House system wire values — Swift `HouseSystem` rawValues (ChartEnums.swift). */
export type HouseSystemName =
  | "Placidus"
  | "Koch"
  | "Porphyrius"
  | "Regiomontanus"
  | "Campanus"
  | "Equal"
  | "Whole Sign"
  | "Meridian"
  | "Morinus"
  | "Alcabitus"
  | "Topocentric"
  | "Vehlow"
  | "Equal (MC)";

const HOUSE_SYSTEMS: readonly HouseSystemName[] = [
  "Placidus",
  "Koch",
  "Porphyrius",
  "Regiomontanus",
  "Campanus",
  "Equal",
  "Whole Sign",
  "Meridian",
  "Morinus",
  "Alcabitus",
  "Topocentric",
  "Vehlow",
  "Equal (MC)",
];

/** Decan rulership system. Wire: lowercase. Default "chaldean". */
export type DecanSystemName = "chaldean" | "triplicity" | "modern";
const DECAN_SYSTEMS: readonly DecanSystemName[] = ["chaldean", "triplicity", "modern"];

/** Sign rulership system. Wire: lowercase. Default "traditional". */
export type SignRulerSystemName = "traditional" | "modern";
const SIGN_RULER_SYSTEMS: readonly SignRulerSystemName[] = ["traditional", "modern"];

/**
 * Term system. Wire: lowercase. Default "egyptian". (`"chaldean"` here is
 * distinct from DecanSystem's — term boundaries vs decan ruler order;
 * lexicon namespacing keeps them apart on the wire.)
 */
export type TermsSystemName = "egyptian" | "ptolemaic" | "chaldean";
const TERMS_SYSTEMS: readonly TermsSystemName[] = ["egyptian", "ptolemaic", "chaldean"];

/** Lunar mansion system. Wire: lowercase. Default "nakshatras". */
export type LunarMansionSystemName = "nakshatras" | "manzils";
const LUNAR_MANSION_SYSTEMS: readonly LunarMansionSystemName[] = ["nakshatras", "manzils"];

/** Mansion display mode. Wire: lowercase. Default "rulers". */
export type MansionDisplayModeName = "rulers" | "symbols";
const MANSION_DISPLAY_MODES: readonly MansionDisplayModeName[] = ["rulers", "symbols"];

// =============================================================================
// AspectOrbs (nested in the aspects content; Task 4 reuses for
// preset-level AspectConfiguration)
// =============================================================================

/**
 * Aspect orb configuration. Wire: `{ "orbs": { "Conjunction": 8.0, ... } }` —
 * the nested `"orbs"` key is literal (no serde rename on the inner field;
 * verified in classic.json `/aspects/orbs`, 2026-08-14). Keys are PascalCase
 * AspectType raw values.
 *
 * Partial maps pass through un-merged — Swift decodes the dictionary as-is
 * and falls back per-key at READ time (`AspectConfiguration.orb(for:)`).
 * Unknown keys pass through; non-finite-number values drop out (the
 * hitRadiusOverrides convention). A missing/malformed `orbs` key falls back
 * to the whole default map.
 */
export interface AspectOrbs {
  orbs: Record<string, number>;
}

/** Default orbs per Swift `AspectOrbs.default` — Square 7.0 (see DRIFT RECORD). */
export const ASPECT_ORBS_DEFAULT: AspectOrbs = {
  orbs: {
    Conjunction: 8.0,
    Opposition: 8.0,
    Trine: 8.0,
    Square: 7.0,
    Sextile: 6.0,
    Quincunx: 3.0,
    Semisextile: 2.0,
    Semisquare: 2.0,
    Sesquisquare: 2.0,
    Quintile: 2.0,
    Biquintile: 2.0,
  },
};

export function parseAspectOrbs(v: unknown): AspectOrbs {
  const o = obj(v);
  const inner = o.orbs;
  if (inner === undefined || inner === null || typeof inner !== "object" || Array.isArray(inner)) {
    return { orbs: { ...ASPECT_ORBS_DEFAULT.orbs } };
  }
  const out: Record<string, number> = {};
  for (const [key, val] of Object.entries(inner)) {
    if (typeof val === "number" && Number.isFinite(val)) out[key] = val;
  }
  return { orbs: out };
}

export function serializeAspectOrbs(a: AspectOrbs): unknown {
  return { orbs: { ...a.orbs } };
}

// =============================================================================
// Zodiac content (Stage 3 inline-fields case)
// =============================================================================

/** Default: Swift `defaultStyleAndContent(.zodiac)` — all three flags true. */
export interface ZodiacRingContent {
  $type: typeof ZODIAC_CONTENT_TYPE;
  showSymbols: boolean;
  showDegrees: boolean;
  showBoundaries: boolean;
}

export const ZODIAC_RING_CONTENT_DEFAULT: ZodiacRingContent = {
  $type: ZODIAC_CONTENT_TYPE,
  showSymbols: true,
  showDegrees: true,
  showBoundaries: true,
};

export function parseZodiacRingContent(v: unknown): ZodiacRingContent {
  const o = obj(v);
  const d = ZODIAC_RING_CONTENT_DEFAULT;
  return {
    $type: ZODIAC_CONTENT_TYPE,
    showSymbols: bool(o.showSymbols, d.showSymbols),
    showDegrees: bool(o.showDegrees, d.showDegrees),
    showBoundaries: bool(o.showBoundaries, d.showBoundaries),
  };
}

export function serializeZodiacRingContent(c: ZodiacRingContent): unknown {
  return {
    $type: c.$type,
    showSymbols: c.showSymbols,
    showDegrees: c.showDegrees,
    showBoundaries: c.showBoundaries,
  };
}

// =============================================================================
// Planets content (Stage 3 inline-fields case)
// =============================================================================

/**
 * Default: Swift `defaultStyleAndContent(.planets)` — showRetrograde true,
 * showSpeeds false.
 *
 * A legacy `bodies` key (pre-2026-06-25-flatten blobs) is decode-and-discard:
 * body visibility is now the preset-wide `visibility` field (Swift PlanetsKeys
 * comment, RingContent.swift:106-110). Rust still DECLARES `bodies` (with
 * `#[serde(default)]`) and re-encodes it; this mirror follows Swift and drops
 * it — the roundtrip policy already drops unknown keys (design ruling).
 */
export interface PlanetsRingContent {
  $type: typeof PLANETS_CONTENT_TYPE;
  showRetrograde: boolean;
  showSpeeds: boolean;
}

export const PLANETS_RING_CONTENT_DEFAULT: PlanetsRingContent = {
  $type: PLANETS_CONTENT_TYPE,
  showRetrograde: true,
  showSpeeds: false,
};

export function parsePlanetsRingContent(v: unknown): PlanetsRingContent {
  const o = obj(v);
  const d = PLANETS_RING_CONTENT_DEFAULT;
  return {
    $type: PLANETS_CONTENT_TYPE,
    showRetrograde: bool(o.showRetrograde, d.showRetrograde),
    showSpeeds: bool(o.showSpeeds, d.showSpeeds),
  };
}

export function serializePlanetsRingContent(c: PlanetsRingContent): unknown {
  return {
    $type: c.$type,
    showRetrograde: c.showRetrograde,
    showSpeeds: c.showSpeeds,
  };
}

// =============================================================================
// Houses content (Stage 3 inline-fields case)
// =============================================================================

/** Default: Swift `defaultStyleAndContent(.houses)` — Placidus, cusps + numbers on. */
export interface HousesRingContent {
  $type: typeof HOUSES_CONTENT_TYPE;
  system: HouseSystemName;
  showCusps: boolean;
  showNumbers: boolean;
}

export const HOUSES_RING_CONTENT_DEFAULT: HousesRingContent = {
  $type: HOUSES_CONTENT_TYPE,
  system: "Placidus",
  showCusps: true,
  showNumbers: true,
};

export function parseHousesRingContent(v: unknown): HousesRingContent {
  const o = obj(v);
  const d = HOUSES_RING_CONTENT_DEFAULT;
  return {
    $type: HOUSES_CONTENT_TYPE,
    system: oneOf(o.system, HOUSE_SYSTEMS, d.system),
    showCusps: bool(o.showCusps, d.showCusps),
    showNumbers: bool(o.showNumbers, d.showNumbers),
  };
}

export function serializeHousesRingContent(c: HousesRingContent): unknown {
  return {
    $type: c.$type,
    system: c.system,
    showCusps: c.showCusps,
    showNumbers: c.showNumbers,
  };
}

// =============================================================================
// Aspects content (Stage 3 inline-fields case)
// =============================================================================

/**
 * Default: Swift `defaultStyleAndContent(.aspects)` — enabledTypes is
 * `AspectType.allCases` (ALL eleven, in Swift declaration order), orbs
 * `.default`, showGrid true. (Distinct from the preset-level
 * `AspectConfiguration.default`, which enables only the 5 Ptolemaic majors.)
 *
 * `enabledTypes` holds PascalCase AspectType raw values; unknown strings pass
 * through untouched (the VisibilityConfiguration convention — Swift would
 * throw the blob; this mirror is deliberately more tolerant).
 */
export interface AspectsRingContent {
  $type: typeof ASPECTS_CONTENT_TYPE;
  enabledTypes: string[];
  orbs: AspectOrbs;
  showGrid: boolean;
}

export const ASPECTS_RING_CONTENT_DEFAULT: AspectsRingContent = {
  $type: ASPECTS_CONTENT_TYPE,
  enabledTypes: [
    "Conjunction",
    "Opposition",
    "Trine",
    "Square",
    "Sextile",
    "Quincunx",
    "Semisextile",
    "Semisquare",
    "Sesquisquare",
    "Quintile",
    "Biquintile",
  ],
  orbs: ASPECT_ORBS_DEFAULT,
  showGrid: true,
};

export function parseAspectsRingContent(v: unknown): AspectsRingContent {
  const o = obj(v);
  const d = ASPECTS_RING_CONTENT_DEFAULT;
  return {
    $type: ASPECTS_CONTENT_TYPE,
    enabledTypes: strArr(o.enabledTypes, d.enabledTypes),
    orbs: parseAspectOrbs(o.orbs),
    showGrid: bool(o.showGrid, d.showGrid),
  };
}

export function serializeAspectsRingContent(c: AspectsRingContent): unknown {
  return {
    $type: c.$type,
    enabledTypes: [...c.enabledTypes],
    orbs: serializeAspectOrbs(c.orbs),
    showGrid: c.showGrid,
  };
}

// =============================================================================
// Stage 3.5 contents (dedicated structs)
// =============================================================================

/** Default: `{ system: "chaldean" }` (Swift/Rust agree). */
export interface DecansContent {
  $type: typeof DECANS_CONTENT_TYPE;
  system: DecanSystemName;
}

export const DECANS_CONTENT_DEFAULT: DecansContent = {
  $type: DECANS_CONTENT_TYPE,
  system: "chaldean",
};

export function parseDecansContent(v: unknown): DecansContent {
  const o = obj(v);
  return { $type: DECANS_CONTENT_TYPE, system: oneOf(o.system, DECAN_SYSTEMS, "chaldean") };
}

export function serializeDecansContent(c: DecansContent): unknown {
  return { $type: c.$type, system: c.system };
}

/** Default: `{ system: "traditional" }` (Swift/Rust agree). */
export interface SignRulersContent {
  $type: typeof SIGN_RULERS_CONTENT_TYPE;
  system: SignRulerSystemName;
}

export const SIGN_RULERS_CONTENT_DEFAULT: SignRulersContent = {
  $type: SIGN_RULERS_CONTENT_TYPE,
  system: "traditional",
};

export function parseSignRulersContent(v: unknown): SignRulersContent {
  const o = obj(v);
  return {
    $type: SIGN_RULERS_CONTENT_TYPE,
    system: oneOf(o.system, SIGN_RULER_SYSTEMS, "traditional"),
  };
}

export function serializeSignRulersContent(c: SignRulersContent): unknown {
  return { $type: c.$type, system: c.system };
}

/** Default: `{ system: "egyptian" }` (Swift/Rust agree). */
export interface TermsContent {
  $type: typeof TERMS_CONTENT_TYPE;
  system: TermsSystemName;
}

export const TERMS_RING_CONTENT_DEFAULT: TermsContent = {
  $type: TERMS_CONTENT_TYPE,
  system: "egyptian",
};

export function parseTermsContent(v: unknown): TermsContent {
  const o = obj(v);
  return { $type: TERMS_CONTENT_TYPE, system: oneOf(o.system, TERMS_SYSTEMS, "egyptian") };
}

export function serializeTermsContent(c: TermsContent): unknown {
  return { $type: c.$type, system: c.system };
}

/** Default: `{ system: "nakshatras", displayMode: "rulers" }` (Swift/Rust agree). */
export interface LunarMansionsContent {
  $type: typeof LUNAR_MANSIONS_CONTENT_TYPE;
  system: LunarMansionSystemName;
  displayMode: MansionDisplayModeName;
}

export const LUNAR_MANSIONS_CONTENT_DEFAULT: LunarMansionsContent = {
  $type: LUNAR_MANSIONS_CONTENT_TYPE,
  system: "nakshatras",
  displayMode: "rulers",
};

export function parseLunarMansionsContent(v: unknown): LunarMansionsContent {
  const o = obj(v);
  return {
    $type: LUNAR_MANSIONS_CONTENT_TYPE,
    system: oneOf(o.system, LUNAR_MANSION_SYSTEMS, "nakshatras"),
    displayMode: oneOf(o.displayMode, MANSION_DISPLAY_MODES, "rulers"),
  };
}

export function serializeLunarMansionsContent(c: LunarMansionsContent): unknown {
  return { $type: c.$type, system: c.system, displayMode: c.displayMode };
}

/**
 * Fixed stars content — UNIT variant: the wire body is empty, only `$type`.
 * (`showDegrees`/`showSign`/`showMinutes` exist on the Swift struct but are
 * build-time transients injected from `Preset.fixedStars`, explicitly NOT
 * Codable — FixedStarsContent.swift:45-59. Verified: starfield.json
 * `/soloChart/rings[fixedStars]/content` is `{ "$type": ... }`.)
 */
export interface FixedStarsContent {
  $type: typeof FIXED_STARS_CONTENT_TYPE;
}

export const FIXED_STARS_CONTENT_DEFAULT: FixedStarsContent = {
  $type: FIXED_STARS_CONTENT_TYPE,
};

export function parseFixedStarsContent(_v: unknown): FixedStarsContent {
  return { $type: FIXED_STARS_CONTENT_TYPE };
}

export function serializeFixedStarsContent(c: FixedStarsContent): unknown {
  return { $type: c.$type };
}

/**
 * Default: all three flags true (Swift/Rust agree). The "at least one flag
 * must be true" invariant is a tier-2 validation concern, not enforced at
 * parse (Swift's decoder doesn't either).
 */
export interface CuspAnnotationsContent {
  $type: typeof CUSP_ANNOTATIONS_CONTENT_TYPE;
  showSignGlyph: boolean;
  showDegrees: boolean;
  showMinutes: boolean;
}

export const CUSP_ANNOTATIONS_CONTENT_DEFAULT: CuspAnnotationsContent = {
  $type: CUSP_ANNOTATIONS_CONTENT_TYPE,
  showSignGlyph: true,
  showDegrees: true,
  showMinutes: true,
};

export function parseCuspAnnotationsContent(v: unknown): CuspAnnotationsContent {
  const o = obj(v);
  const d = CUSP_ANNOTATIONS_CONTENT_DEFAULT;
  return {
    $type: CUSP_ANNOTATIONS_CONTENT_TYPE,
    showSignGlyph: bool(o.showSignGlyph, d.showSignGlyph),
    showDegrees: bool(o.showDegrees, d.showDegrees),
    showMinutes: bool(o.showMinutes, d.showMinutes),
  };
}

export function serializeCuspAnnotationsContent(c: CuspAnnotationsContent): unknown {
  return {
    $type: c.$type,
    showSignGlyph: c.showSignGlyph,
    showDegrees: c.showDegrees,
    showMinutes: c.showMinutes,
  };
}

// =============================================================================
// RingContent union + dispatch
// =============================================================================

/** All ten ring contents parse; only five render (see header). */
export type RingContent =
  | ZodiacRingContent
  | PlanetsRingContent
  | HousesRingContent
  | AspectsRingContent
  | DecansContent
  | SignRulersContent
  | TermsContent
  | LunarMansionsContent
  | FixedStarsContent
  | CuspAnnotationsContent;

/**
 * The ring type's default content (Swift `defaultStyleAndContent(for:)`,
 * RingModule.swift:174). An unknown ring type degrades to zodiac, mirroring
 * the Swift entity projection's `RingType(rawValue:) ?? .zodiac`. Returns a
 * fresh deep copy (via a serialize→parse round trip through the tested code
 * paths — keeps the aspects default's nested orb map unshared).
 */
export function defaultRingContent(ringType: string): RingContent {
  switch (ringType) {
    case "planets":
      return parsePlanetsRingContent(serializePlanetsRingContent(PLANETS_RING_CONTENT_DEFAULT));
    case "houses":
      return parseHousesRingContent(serializeHousesRingContent(HOUSES_RING_CONTENT_DEFAULT));
    case "aspects":
      return parseAspectsRingContent(serializeAspectsRingContent(ASPECTS_RING_CONTENT_DEFAULT));
    case "decans":
      return parseDecansContent(serializeDecansContent(DECANS_CONTENT_DEFAULT));
    case "signRulers":
      return parseSignRulersContent(serializeSignRulersContent(SIGN_RULERS_CONTENT_DEFAULT));
    case "terms":
      return parseTermsContent(serializeTermsContent(TERMS_RING_CONTENT_DEFAULT));
    case "lunarMansions":
      return parseLunarMansionsContent(
        serializeLunarMansionsContent(LUNAR_MANSIONS_CONTENT_DEFAULT),
      );
    case "fixedStars":
      return parseFixedStarsContent(undefined);
    case "cuspAnnotations":
      return parseCuspAnnotationsContent(
        serializeCuspAnnotationsContent(CUSP_ANNOTATIONS_CONTENT_DEFAULT),
      );
    case "zodiac":
    default:
      return parseZodiacRingContent(serializeZodiacRingContent(ZODIAC_RING_CONTENT_DEFAULT));
  }
}

/**
 * Tolerant union parse. Dispatch is on `$type` alone (Swift RingContent.swift
 * :119-172); missing/unknown `$type` degrades to `ringType`'s default content.
 */
export function parseRingContent(v: unknown, ringType: string): RingContent {
  const t = obj(v).$type;
  switch (t) {
    case ZODIAC_CONTENT_TYPE:
      return parseZodiacRingContent(v);
    case PLANETS_CONTENT_TYPE:
      return parsePlanetsRingContent(v);
    case HOUSES_CONTENT_TYPE:
      return parseHousesRingContent(v);
    case ASPECTS_CONTENT_TYPE:
      return parseAspectsRingContent(v);
    case DECANS_CONTENT_TYPE:
      return parseDecansContent(v);
    case SIGN_RULERS_CONTENT_TYPE:
      return parseSignRulersContent(v);
    case TERMS_CONTENT_TYPE:
      return parseTermsContent(v);
    case LUNAR_MANSIONS_CONTENT_TYPE:
      return parseLunarMansionsContent(v);
    case FIXED_STARS_CONTENT_TYPE:
      return parseFixedStarsContent(v);
    case CUSP_ANNOTATIONS_CONTENT_TYPE:
      return parseCuspAnnotationsContent(v);
    default:
      return defaultRingContent(ringType);
  }
}

/** Serialize: `$type` + content fields (fixedStars emits `$type` only). */
export function serializeRingContent(c: RingContent): unknown {
  switch (c.$type) {
    case ZODIAC_CONTENT_TYPE:
      return serializeZodiacRingContent(c);
    case PLANETS_CONTENT_TYPE:
      return serializePlanetsRingContent(c);
    case HOUSES_CONTENT_TYPE:
      return serializeHousesRingContent(c);
    case ASPECTS_CONTENT_TYPE:
      return serializeAspectsRingContent(c);
    case DECANS_CONTENT_TYPE:
      return serializeDecansContent(c);
    case SIGN_RULERS_CONTENT_TYPE:
      return serializeSignRulersContent(c);
    case TERMS_CONTENT_TYPE:
      return serializeTermsContent(c);
    case LUNAR_MANSIONS_CONTENT_TYPE:
      return serializeLunarMansionsContent(c);
    case FIXED_STARS_CONTENT_TYPE:
      return serializeFixedStarsContent(c);
    case CUSP_ANNOTATIONS_CONTENT_TYPE:
      return serializeCuspAnnotationsContent(c);
    default:
      return { ...(c as Record<string, unknown>) };
  }
}
