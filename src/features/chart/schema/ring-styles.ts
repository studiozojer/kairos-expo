/**
 * Ring style union — `$type`-discriminated, one variant per ring type.
 *
 * Mirrors (field names + defaults cross-checked 2026-08-14):
 *  - swift/KairosCore/Sources/KairosCore/Presets/CodableTypes/RingStyle.swift
 *    (the `$type` TypeID constants + dispatch)
 *  - swift .../CodableTypes/{ZodiacRingStyle,PlanetsRingStyle,HousesRingStyle,
 *    AspectOverlayStyle,DecansStyle,SignRulersStyle,TermsStyle,
 *    LunarMansionsStyle,FixedStarsStyle,CuspAnnotationsStyle}.swift
 *  - kairos-engine crates/kairos-core/src/presets/styles.rs +
 *    presets/content.rs (`RingStyle` tagged union)
 *
 * Wire shape: flat JSON object, `$type` NSID discriminator + camelCase style
 * fields merged in (Rust `#[serde(tag = "$type")]` on tuple variants; Swift
 * encodes TypeID then the struct into the same container). All ten variants
 * PARSE here even though only five render (zodiac/planets/houses/aspects/
 * cuspAnnotations) — an unsupported ring's style must survive a round trip.
 *
 * Tolerance contract: same as core-types.ts — every missing/malformed field
 * falls back to its default; parsing never throws. Where Swift's decoder is
 * stricter (unknown enum raw value, present-but-malformed), this mirror
 * deliberately defaults instead.
 *
 * =============================================================================
 * DRIFT RECORD (2026-08-14) — Swift vs Rust `Default` impls disagree on six
 * fields. Resolved per the standing Task-2 ruling: **Swift is the adjudicated
 * decode behavior** (the design doc mandates mirroring Swift's
 * `decodeIfPresent ?? .default`; every drifted Rust field lacks
 * `#[serde(default)]`, so a missing key hard-errors in Rust — the Rust values
 * are construction-time template seeds, never decode fallbacks). This mirror
 * follows Swift. Affected fields (Swift value used here / Rust value rejected):
 *  - ZodiacRingStyle.showDegreeMarkers:        false / true  (Phase 4 Axis 3)
 *  - PlanetsRingStyle.showDegreeText:          false / true  (Phase 4 Axis 3)
 *  - PlanetsRingStyle.showMinuteText:          false / true  (Phase 4 Axis 3)
 *  - HousesRingStyle.rotateNumbers:            false / true  (Phase 4 Axis 3)
 *  - AspectOverlayStyle.colorMode:      "monochrome" / "byType" (Phase 4 Axis 3)
 *  - AspectOrbs.default Square:                7.0 / 8.0 (see ring-content.ts)
 * The historically known `anchorFromInnerEdge` drift (Rust true, Swift false)
 * is RESOLVED — both platforms now default true (Swift PlanetsRingStyle.swift
 * :264 "Matches Rust's canonical default (Phase 4 Axis 3)").
 * The adjudicated overlapPrevention.nudgeDistance drift (Swift 0.0 / Rust 8.0)
 * lives in core-types.ts; `PlanetsRingStyle.overlapPrevention` reuses
 * OVERLAP_PREVENTION_DEFAULT per that record's "one ruling, two call sites".
 * =============================================================================
 */

import {
  OVERLAP_PREVENTION_DEFAULT,
  parseColorValue,
  parseOverlapPrevention,
  serializeColorValue,
  serializeOverlapPrevention,
  type ColorValue,
  type OverlapPreventionConfig,
} from "./core-types";
import { alias, bool, num, numArr, obj, oneOf } from "./decode";

// ---------------------------------------------------------------------------
// $type discriminator NSIDs (verbatim from RingStyle.swift TypeID, :50-61)
// ---------------------------------------------------------------------------

export const ZODIAC_STYLE_TYPE = "solar.kairos.preset.ring.style.zodiac";
export const PLANETS_STYLE_TYPE = "solar.kairos.preset.ring.style.planets";
export const HOUSES_STYLE_TYPE = "solar.kairos.preset.ring.style.houses";
export const ASPECTS_STYLE_TYPE = "solar.kairos.preset.ring.style.aspects";
export const DECANS_STYLE_TYPE = "solar.kairos.preset.ring.style.decans";
export const SIGN_RULERS_STYLE_TYPE = "solar.kairos.preset.ring.style.signRulers";
export const TERMS_STYLE_TYPE = "solar.kairos.preset.ring.style.terms";
export const LUNAR_MANSIONS_STYLE_TYPE = "solar.kairos.preset.ring.style.lunarMansions";
export const FIXED_STARS_STYLE_TYPE = "solar.kairos.preset.ring.style.fixedStars";
export const CUSP_ANNOTATIONS_STYLE_TYPE = "solar.kairos.preset.ring.style.cuspAnnotations";

/**
 * Optional ColorValue override: absent/malformed → undefined ("use theme
 * defaults"). Swift `decodeIfPresent(ColorValue.self)` yields nil when absent
 * and throws when malformed; this mirror treats malformed as absent (the
 * tolerance convention). A present object decodes per-field tolerantly.
 */
function optColor(v: unknown): ColorValue | undefined {
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "object" || Array.isArray(v)) return undefined;
  return parseColorValue(v);
}

/** Conditional spread — undefined optionals are omitted on the wire. */
function optColorEntry(key: string, c: ColorValue | undefined): Record<string, unknown> {
  return c === undefined ? {} : { [key]: serializeColorValue(c) };
}

/**
 * Optional enum (`T | undefined`): absent → undefined; present + known → T;
 * present + unknown → undefined (Swift `decodeIfPresent` would throw on the
 * unknown raw value and fail the whole blob; this mirror treats it as absent).
 */
function optEnum<T extends string>(v: unknown, allowed: readonly T[]): T | undefined {
  if (v === undefined || v === null) return undefined;
  return typeof v === "string" && (allowed as readonly string[]).includes(v)
    ? (v as T)
    : undefined;
}

// =============================================================================
// ZodiacRingStyle
// =============================================================================

/** Zodiac ring styling. Default: Swift `ZodiacRingStyle.default` (see DRIFT RECORD). */
export interface ZodiacRingStyle {
  $type: typeof ZODIAC_STYLE_TYPE;
  glyphSize: number;
  rotateGlyphs: boolean;
  glyphColor: ColorValue | undefined;
  segmentBorderWidth: number;
  radialLineWidth: number;
  segmentBorderColor: ColorValue | undefined;
  radialLineColor: ColorValue | undefined;
  backgroundColor: ColorValue | undefined;
  showDegreeMarkers: boolean;
  majorMarkInterval: number;
  minorMarkInterval: number;
  majorMarkLength: number;
  minorMarkLength: number;
  majorMarkWidth: number;
  minorMarkWidth: number;
}

export const ZODIAC_RING_STYLE_DEFAULT: ZodiacRingStyle = {
  $type: ZODIAC_STYLE_TYPE,
  glyphSize: 18.0,
  rotateGlyphs: false,
  glyphColor: undefined,
  segmentBorderWidth: 0.5,
  radialLineWidth: 0.5,
  segmentBorderColor: undefined,
  radialLineColor: undefined,
  backgroundColor: undefined,
  showDegreeMarkers: false, // DRIFT RECORD: Rust styles.rs:171 says true (Phase 4 Axis 3); Swift decode default is false — Swift wins.
  majorMarkInterval: 10.0,
  minorMarkInterval: 1.0,
  majorMarkLength: 6.0,
  minorMarkLength: 3.0,
  majorMarkWidth: 0.5,
  minorMarkWidth: 0.25,
};

export function parseZodiacRingStyle(v: unknown): ZodiacRingStyle {
  const o = obj(v);
  const d = ZODIAC_RING_STYLE_DEFAULT;
  return {
    $type: ZODIAC_STYLE_TYPE,
    glyphSize: num(o.glyphSize, d.glyphSize),
    rotateGlyphs: bool(o.rotateGlyphs, d.rotateGlyphs),
    glyphColor: optColor(o.glyphColor),
    segmentBorderWidth: num(o.segmentBorderWidth, d.segmentBorderWidth),
    radialLineWidth: num(o.radialLineWidth, d.radialLineWidth),
    segmentBorderColor: optColor(o.segmentBorderColor),
    radialLineColor: optColor(o.radialLineColor),
    backgroundColor: optColor(o.backgroundColor),
    showDegreeMarkers: bool(o.showDegreeMarkers, d.showDegreeMarkers),
    majorMarkInterval: num(o.majorMarkInterval, d.majorMarkInterval),
    minorMarkInterval: num(o.minorMarkInterval, d.minorMarkInterval),
    majorMarkLength: num(o.majorMarkLength, d.majorMarkLength),
    minorMarkLength: num(o.minorMarkLength, d.minorMarkLength),
    majorMarkWidth: num(o.majorMarkWidth, d.majorMarkWidth),
    minorMarkWidth: num(o.minorMarkWidth, d.minorMarkWidth),
  };
}

export function serializeZodiacRingStyle(s: ZodiacRingStyle): unknown {
  return {
    $type: s.$type,
    glyphSize: s.glyphSize,
    rotateGlyphs: s.rotateGlyphs,
    ...optColorEntry("glyphColor", s.glyphColor),
    segmentBorderWidth: s.segmentBorderWidth,
    radialLineWidth: s.radialLineWidth,
    ...optColorEntry("segmentBorderColor", s.segmentBorderColor),
    ...optColorEntry("radialLineColor", s.radialLineColor),
    ...optColorEntry("backgroundColor", s.backgroundColor),
    showDegreeMarkers: s.showDegreeMarkers,
    majorMarkInterval: s.majorMarkInterval,
    minorMarkInterval: s.minorMarkInterval,
    majorMarkLength: s.majorMarkLength,
    minorMarkLength: s.minorMarkLength,
    majorMarkWidth: s.majorMarkWidth,
    minorMarkWidth: s.minorMarkWidth,
  };
}

// =============================================================================
// PlanetsRingStyle
// =============================================================================

/**
 * Planets ring styling. Default: Swift `PlanetsRingStyle.default`
 * (PlanetsRingStyle.swift:241-279; see DRIFT RECORD).
 *
 * Legacy key aliases (Swift `PlanetsRingStyleLegacyAliasKeys`; Rust
 * `#[serde(alias)]` — both platforms agree, both are mirrored):
 *  - `glyphInsetFromTicks` → `glyphInsetFromAnchor` (renamed 2026-05-31)
 *  - `elementsFromInnerEdge` → `anchorFromInnerEdge` (renamed 2026-06-01)
 * Current key wins when both are present (Swift prefers the current key).
 */
export interface PlanetsRingStyle {
  $type: typeof PLANETS_STYLE_TYPE;
  useGlyphs: boolean;
  showFrameDerivedPoints: boolean;
  glyphSize: number;
  showSignGlyph: boolean;
  showRetrogradeGlyph: boolean;
  glyphColor: ColorValue | undefined;
  circleRadius: number;
  showDegreeText: boolean;
  showMinuteText: boolean;
  degreeTextFontSize: number;
  degreeTextOffset: number;
  degreeTextLineSpacing: number;
  degreeTextColor: ColorValue | undefined;
  signGlyphColor: ColorValue | undefined;
  showDegreeMarks: boolean;
  degreeMarkLength: number;
  degreeMarkWidth: number;
  connectionLineWidth: number;
  glyphInsetFromAnchor: number;
  anchorFromInnerEdge: boolean;
  invertGlyphOrder: boolean;
  showTicksOnBothEdges: boolean;
  showConnectionOnBothEdges: boolean;
  backgroundColor: ColorValue | undefined;
  boundaryLineColor: ColorValue | undefined;
  innerBoundaryLineWidth: number;
  outerBoundaryLineWidth: number;
  overlapPrevention: OverlapPreventionConfig;
  showCuspLines: boolean;
  cuspLineWidth: number;
  thickAngularLines: boolean;
  angularCuspLineWidth: number;
  cuspLineColor: ColorValue | undefined;
  angularCuspLineColor: ColorValue | undefined;
}

export const PLANETS_RING_STYLE_DEFAULT: PlanetsRingStyle = {
  $type: PLANETS_STYLE_TYPE,
  useGlyphs: true,
  showFrameDerivedPoints: true,
  glyphSize: 18.0,
  showSignGlyph: false,
  showRetrogradeGlyph: false,
  glyphColor: undefined,
  circleRadius: 5.0,
  showDegreeText: false, // DRIFT RECORD: Rust says true (Phase 4 Axis 3); Swift decode default is false — Swift wins.
  showMinuteText: false, // DRIFT RECORD: same — Rust true / Swift false.
  degreeTextFontSize: 10.0,
  degreeTextOffset: 10.0,
  degreeTextLineSpacing: 1.0,
  degreeTextColor: undefined,
  signGlyphColor: undefined,
  showDegreeMarks: true,
  degreeMarkLength: 4.0,
  degreeMarkWidth: 0.5,
  connectionLineWidth: 0.5, // D13: Legacy retained over Stage 3.5's 0.25
  glyphInsetFromAnchor: 8.0,
  anchorFromInnerEdge: true, // Both platforms now agree (see DRIFT RECORD header).
  invertGlyphOrder: false,
  showTicksOnBothEdges: false,
  showConnectionOnBothEdges: false,
  backgroundColor: undefined,
  boundaryLineColor: undefined,
  innerBoundaryLineWidth: 1.0,
  outerBoundaryLineWidth: 0.0,
  overlapPrevention: OVERLAP_PREVENTION_DEFAULT, // Adjudicated nudgeDistance 0.0 (core-types.ts).
  showCuspLines: true,
  cuspLineWidth: 0.5,
  thickAngularLines: false,
  angularCuspLineWidth: 1.0,
  cuspLineColor: undefined,
  angularCuspLineColor: undefined,
};

export function parsePlanetsRingStyle(v: unknown): PlanetsRingStyle {
  const o = obj(v);
  const d = PLANETS_RING_STYLE_DEFAULT;
  return {
    $type: PLANETS_STYLE_TYPE,
    useGlyphs: bool(o.useGlyphs, d.useGlyphs),
    showFrameDerivedPoints: bool(o.showFrameDerivedPoints, d.showFrameDerivedPoints),
    glyphSize: num(o.glyphSize, d.glyphSize),
    showSignGlyph: bool(o.showSignGlyph, d.showSignGlyph),
    showRetrogradeGlyph: bool(o.showRetrogradeGlyph, d.showRetrogradeGlyph),
    glyphColor: optColor(o.glyphColor),
    circleRadius: num(o.circleRadius, d.circleRadius),
    showDegreeText: bool(o.showDegreeText, d.showDegreeText),
    showMinuteText: bool(o.showMinuteText, d.showMinuteText),
    degreeTextFontSize: num(o.degreeTextFontSize, d.degreeTextFontSize),
    degreeTextOffset: num(o.degreeTextOffset, d.degreeTextOffset),
    degreeTextLineSpacing: num(o.degreeTextLineSpacing, d.degreeTextLineSpacing),
    degreeTextColor: optColor(o.degreeTextColor),
    signGlyphColor: optColor(o.signGlyphColor),
    showDegreeMarks: bool(o.showDegreeMarks, d.showDegreeMarks),
    degreeMarkLength: num(o.degreeMarkLength, d.degreeMarkLength),
    degreeMarkWidth: num(o.degreeMarkWidth, d.degreeMarkWidth),
    connectionLineWidth: num(o.connectionLineWidth, d.connectionLineWidth),
    glyphInsetFromAnchor: num(
      alias(o, "glyphInsetFromAnchor", "glyphInsetFromTicks"),
      d.glyphInsetFromAnchor,
    ),
    anchorFromInnerEdge: bool(
      alias(o, "anchorFromInnerEdge", "elementsFromInnerEdge"),
      d.anchorFromInnerEdge,
    ),
    invertGlyphOrder: bool(o.invertGlyphOrder, d.invertGlyphOrder),
    showTicksOnBothEdges: bool(o.showTicksOnBothEdges, d.showTicksOnBothEdges),
    showConnectionOnBothEdges: bool(o.showConnectionOnBothEdges, d.showConnectionOnBothEdges),
    backgroundColor: optColor(o.backgroundColor),
    boundaryLineColor: optColor(o.boundaryLineColor),
    innerBoundaryLineWidth: num(o.innerBoundaryLineWidth, d.innerBoundaryLineWidth),
    outerBoundaryLineWidth: num(o.outerBoundaryLineWidth, d.outerBoundaryLineWidth),
    overlapPrevention: parseOverlapPrevention(o.overlapPrevention),
    showCuspLines: bool(o.showCuspLines, d.showCuspLines),
    cuspLineWidth: num(o.cuspLineWidth, d.cuspLineWidth),
    thickAngularLines: bool(o.thickAngularLines, d.thickAngularLines),
    angularCuspLineWidth: num(o.angularCuspLineWidth, d.angularCuspLineWidth),
    cuspLineColor: optColor(o.cuspLineColor),
    angularCuspLineColor: optColor(o.angularCuspLineColor),
  };
}

export function serializePlanetsRingStyle(s: PlanetsRingStyle): unknown {
  return {
    $type: s.$type,
    useGlyphs: s.useGlyphs,
    showFrameDerivedPoints: s.showFrameDerivedPoints,
    glyphSize: s.glyphSize,
    showSignGlyph: s.showSignGlyph,
    showRetrogradeGlyph: s.showRetrogradeGlyph,
    ...optColorEntry("glyphColor", s.glyphColor),
    circleRadius: s.circleRadius,
    showDegreeText: s.showDegreeText,
    showMinuteText: s.showMinuteText,
    degreeTextFontSize: s.degreeTextFontSize,
    degreeTextOffset: s.degreeTextOffset,
    degreeTextLineSpacing: s.degreeTextLineSpacing,
    ...optColorEntry("degreeTextColor", s.degreeTextColor),
    ...optColorEntry("signGlyphColor", s.signGlyphColor),
    showDegreeMarks: s.showDegreeMarks,
    degreeMarkLength: s.degreeMarkLength,
    degreeMarkWidth: s.degreeMarkWidth,
    connectionLineWidth: s.connectionLineWidth,
    glyphInsetFromAnchor: s.glyphInsetFromAnchor,
    anchorFromInnerEdge: s.anchorFromInnerEdge,
    invertGlyphOrder: s.invertGlyphOrder,
    showTicksOnBothEdges: s.showTicksOnBothEdges,
    showConnectionOnBothEdges: s.showConnectionOnBothEdges,
    ...optColorEntry("backgroundColor", s.backgroundColor),
    ...optColorEntry("boundaryLineColor", s.boundaryLineColor),
    innerBoundaryLineWidth: s.innerBoundaryLineWidth,
    outerBoundaryLineWidth: s.outerBoundaryLineWidth,
    overlapPrevention: serializeOverlapPrevention(s.overlapPrevention),
    showCuspLines: s.showCuspLines,
    cuspLineWidth: s.cuspLineWidth,
    thickAngularLines: s.thickAngularLines,
    angularCuspLineWidth: s.angularCuspLineWidth,
    ...optColorEntry("cuspLineColor", s.cuspLineColor),
    ...optColorEntry("angularCuspLineColor", s.angularCuspLineColor),
  };
}

// =============================================================================
// HousesRingStyle
// =============================================================================

/** Font weight for house numbers. Wire: lowercase (Rust `rename_all = "lowercase"`). */
export type PresetFontWeight =
  | "ultralight"
  | "thin"
  | "light"
  | "regular"
  | "medium"
  | "semibold"
  | "bold"
  | "heavy"
  | "black";

const FONT_WEIGHTS: readonly PresetFontWeight[] = [
  "ultralight",
  "thin",
  "light",
  "regular",
  "medium",
  "semibold",
  "bold",
  "heavy",
  "black",
];

/** Which ring cusp lines extend to. Wire: camelCase. */
export type RingTarget = "zodiacRing" | "planetsRing" | "innermost";

const RING_TARGETS: readonly RingTarget[] = ["zodiacRing", "planetsRing", "innermost"];

/**
 * Houses ring styling. Default: Swift `HousesRingStyle.default` (see DRIFT
 * RECORD on rotateNumbers).
 *
 * Legacy key alias (Swift-only: `RingBoundaryLegacyAliasKeys`, shared with
 * fixedStars + cuspAnnotations — the three rings that gained the
 * inner/outer split): a pre-split blob's single `boundaryLineWidth` seeds
 * BOTH `innerBoundaryLineWidth` and `outerBoundaryLineWidth`; the current
 * keys win individually when present. Rust carries no such serde alias.
 */
export interface HousesRingStyle {
  $type: typeof HOUSES_STYLE_TYPE;
  numberFontSize: number;
  numberFontWeight: PresetFontWeight;
  rotateNumbers: boolean;
  cuspLineWidth: number;
  angularCuspLineWidth: number;
  thickAngularLines: boolean;
  cuspLineColor: ColorValue | undefined;
  angularCuspLineColor: ColorValue | undefined;
  extendCuspsToRing: RingTarget | undefined;
  backgroundColor: ColorValue | undefined;
  innerBoundaryLineWidth: number;
  outerBoundaryLineWidth: number;
  boundaryLineColor: ColorValue | undefined;
}

export const HOUSES_RING_STYLE_DEFAULT: HousesRingStyle = {
  $type: HOUSES_STYLE_TYPE,
  numberFontSize: 12.0,
  numberFontWeight: "regular",
  rotateNumbers: false, // DRIFT RECORD: Rust styles.rs:491 says true (Phase 4 Axis 3); Swift decode default is false — Swift wins.
  cuspLineWidth: 0.5,
  angularCuspLineWidth: 1.0,
  thickAngularLines: false,
  cuspLineColor: undefined,
  angularCuspLineColor: undefined,
  extendCuspsToRing: undefined,
  backgroundColor: undefined,
  innerBoundaryLineWidth: 0.5,
  outerBoundaryLineWidth: 0.5,
  boundaryLineColor: undefined,
};

export function parseHousesRingStyle(v: unknown): HousesRingStyle {
  const o = obj(v);
  const d = HOUSES_RING_STYLE_DEFAULT;
  return {
    $type: HOUSES_STYLE_TYPE,
    numberFontSize: num(o.numberFontSize, d.numberFontSize),
    numberFontWeight: oneOf(o.numberFontWeight, FONT_WEIGHTS, d.numberFontWeight),
    rotateNumbers: bool(o.rotateNumbers, d.rotateNumbers),
    cuspLineWidth: num(o.cuspLineWidth, d.cuspLineWidth),
    angularCuspLineWidth: num(o.angularCuspLineWidth, d.angularCuspLineWidth),
    thickAngularLines: bool(o.thickAngularLines, d.thickAngularLines),
    cuspLineColor: optColor(o.cuspLineColor),
    angularCuspLineColor: optColor(o.angularCuspLineColor),
    extendCuspsToRing: optEnum(o.extendCuspsToRing, RING_TARGETS),
    backgroundColor: optColor(o.backgroundColor),
    innerBoundaryLineWidth: num(
      alias(o, "innerBoundaryLineWidth", "boundaryLineWidth"),
      d.innerBoundaryLineWidth,
    ),
    outerBoundaryLineWidth: num(
      alias(o, "outerBoundaryLineWidth", "boundaryLineWidth"),
      d.outerBoundaryLineWidth,
    ),
    boundaryLineColor: optColor(o.boundaryLineColor),
  };
}

export function serializeHousesRingStyle(s: HousesRingStyle): unknown {
  return {
    $type: s.$type,
    numberFontSize: s.numberFontSize,
    numberFontWeight: s.numberFontWeight,
    rotateNumbers: s.rotateNumbers,
    cuspLineWidth: s.cuspLineWidth,
    angularCuspLineWidth: s.angularCuspLineWidth,
    thickAngularLines: s.thickAngularLines,
    ...optColorEntry("cuspLineColor", s.cuspLineColor),
    ...optColorEntry("angularCuspLineColor", s.angularCuspLineColor),
    ...(s.extendCuspsToRing === undefined ? {} : { extendCuspsToRing: s.extendCuspsToRing }),
    ...optColorEntry("backgroundColor", s.backgroundColor),
    innerBoundaryLineWidth: s.innerBoundaryLineWidth,
    outerBoundaryLineWidth: s.outerBoundaryLineWidth,
    ...optColorEntry("boundaryLineColor", s.boundaryLineColor),
  };
}

// =============================================================================
// AspectOverlayStyle (aspects ring style)
// =============================================================================

/** How aspect lines are colored. Wire: camelCase. */
export type AspectColorMode = "byType" | "byCelestial" | "monochrome";

const ASPECT_COLOR_MODES: readonly AspectColorMode[] = ["byType", "byCelestial", "monochrome"];

/** How aspect lines are drawn geometrically. Wire: lowercase. */
export type AspectRenderMode = "straight" | "bezier";

const ASPECT_RENDER_MODES: readonly AspectRenderMode[] = ["straight", "bezier"];

/**
 * Aspect hue assignments — hue tokens per aspect type.
 *
 * Wire keys are **PascalCase** with four irregulars ("Semisextile",
 * "Semisquare", "Sesquisquare", "MinorAspect") — a Stage 3.5 D10 known
 * exception to camelCase (Rust `rename_all = "PascalCase"`; Swift CodingKeys
 * in Support/ColorSets.swift). Property names mirror Swift's.
 *
 * Values are typed `string` for tolerance (ColorValue convention): unknown
 * hue tokens pass through untouched. Default: Swift `AspectHues.default`
 * (== Rust `AspectHues::default()` — identical).
 */
export interface AspectHues {
  conjunction: string;
  opposition: string;
  trine: string;
  square: string;
  sextile: string;
  quincunx: string;
  semiSextile: string;
  semiSquare: string;
  sesquiquadrate: string;
  quintile: string;
  biquintile: string;
  minorAspectHue: string;
}

export const ASPECT_HUES_DEFAULT: AspectHues = {
  conjunction: "red",
  opposition: "red",
  trine: "blue",
  square: "orange",
  sextile: "green",
  quincunx: "purple",
  semiSextile: "yellow",
  semiSquare: "magenta",
  sesquiquadrate: "indigo",
  quintile: "aqua",
  biquintile: "sky",
  minorAspectHue: "greyscale",
};

export function parseAspectHues(v: unknown): AspectHues {
  const o = obj(v);
  const d = ASPECT_HUES_DEFAULT;
  const hue = (key: string, fallback: string): string => {
    const val = o[key];
    return typeof val === "string" ? val : fallback;
  };
  return {
    conjunction: hue("Conjunction", d.conjunction),
    opposition: hue("Opposition", d.opposition),
    trine: hue("Trine", d.trine),
    square: hue("Square", d.square),
    sextile: hue("Sextile", d.sextile),
    quincunx: hue("Quincunx", d.quincunx),
    semiSextile: hue("Semisextile", d.semiSextile),
    semiSquare: hue("Semisquare", d.semiSquare),
    sesquiquadrate: hue("Sesquisquare", d.sesquiquadrate),
    quintile: hue("Quintile", d.quintile),
    biquintile: hue("Biquintile", d.biquintile),
    minorAspectHue: hue("MinorAspect", d.minorAspectHue),
  };
}

export function serializeAspectHues(h: AspectHues): unknown {
  return {
    Conjunction: h.conjunction,
    Opposition: h.opposition,
    Trine: h.trine,
    Square: h.square,
    Sextile: h.sextile,
    Quincunx: h.quincunx,
    Semisextile: h.semiSextile,
    Semisquare: h.semiSquare,
    Sesquisquare: h.sesquiquadrate,
    Quintile: h.quintile,
    Biquintile: h.biquintile,
    MinorAspect: h.minorAspectHue,
  };
}

/**
 * Aspects layer styling. Used BOTH as the aspects ring style (under
 * `$type` "...ring.style.aspects") and as the preset-level `aspectOverlay`
 * field (bare, no `$type` — Task 4 reuses this parse/serialize pair).
 *
 * Default: Swift `AspectOverlayStyle.default` (see DRIFT RECORD on colorMode).
 * Wire verified against classic.json `/aspectOverlay` (2026-08-14).
 */
export interface AspectOverlayStyle {
  $type: typeof ASPECTS_STYLE_TYPE;
  colorMode: AspectColorMode;
  monochromeColor: ColorValue;
  /** Thickness at exactness; orb weighting can only make it thinner. */
  lineWidth: number;
  /** Expo extension: 0 = uniform, 1 = full squared orb falloff. */
  orbWeighting: number;
  opacity: number;
  useDashedForSeparating: boolean;
  dashPattern: number[];
  renderMode: AspectRenderMode;
  bezierCurveStrength: number;
  showMajorAspectsOnly: boolean;
  minimumStrength: number;
  /** 0 = unlimited. */
  maximumAspectCount: number;
  aspectHues: AspectHues;
}

export const ASPECT_OVERLAY_STYLE_DEFAULT: AspectOverlayStyle = {
  $type: ASPECTS_STYLE_TYPE,
  colorMode: "monochrome", // DRIFT RECORD: Rust styles.rs:594 says ByType (Phase 4 Axis 3); Swift decode default is monochrome — Swift wins.
  monochromeColor: { source: "semantic", value: "tertiary", layer: "primitive" },
  lineWidth: 0.5,
  orbWeighting: 0,
  opacity: 0.4,
  useDashedForSeparating: false,
  dashPattern: [4.0, 4.0],
  renderMode: "straight",
  bezierCurveStrength: 0.3,
  showMajorAspectsOnly: false,
  minimumStrength: 0.0,
  maximumAspectCount: 0,
  aspectHues: ASPECT_HUES_DEFAULT,
};

/**
 * Parse the aspect-overlay FIELDS from an already-`obj()`-ed body; `$type` is
 * attached by the caller so the same parser serves the ring style and the
 * preset-level field.
 */
export function parseAspectOverlayStyle(v: unknown): AspectOverlayStyle {
  const o = obj(v);
  const d = ASPECT_OVERLAY_STYLE_DEFAULT;
  return {
    $type: ASPECTS_STYLE_TYPE,
    colorMode: oneOf(o.colorMode, ASPECT_COLOR_MODES, d.colorMode),
    monochromeColor:
      o.monochromeColor === undefined || o.monochromeColor === null
        ? { ...d.monochromeColor }
        : parseColorValue(o.monochromeColor),
    lineWidth: num(o.lineWidth, d.lineWidth),
    orbWeighting: Math.max(0, Math.min(1, num(o.orbWeighting, d.orbWeighting))),
    opacity: num(o.opacity, d.opacity),
    useDashedForSeparating: bool(o.useDashedForSeparating, d.useDashedForSeparating),
    dashPattern: numArr(o.dashPattern, d.dashPattern),
    renderMode: oneOf(o.renderMode, ASPECT_RENDER_MODES, d.renderMode),
    bezierCurveStrength: num(o.bezierCurveStrength, d.bezierCurveStrength),
    showMajorAspectsOnly: bool(o.showMajorAspectsOnly, d.showMajorAspectsOnly),
    minimumStrength: num(o.minimumStrength, d.minimumStrength),
    maximumAspectCount: num(o.maximumAspectCount, d.maximumAspectCount),
    aspectHues: parseAspectHues(o.aspectHues),
  };
}

export function serializeAspectOverlayStyle(s: AspectOverlayStyle): unknown {
  return {
    $type: s.$type,
    colorMode: s.colorMode,
    monochromeColor: serializeColorValue(s.monochromeColor),
    lineWidth: s.lineWidth,
    orbWeighting: s.orbWeighting,
    opacity: s.opacity,
    useDashedForSeparating: s.useDashedForSeparating,
    dashPattern: [...s.dashPattern],
    renderMode: s.renderMode,
    bezierCurveStrength: s.bezierCurveStrength,
    showMajorAspectsOnly: s.showMajorAspectsOnly,
    minimumStrength: s.minimumStrength,
    maximumAspectCount: s.maximumAspectCount,
    aspectHues: serializeAspectHues(s.aspectHues),
  };
}

// =============================================================================
// DecansStyle (renamed from DecanRulersStyle, Stage 3.5 D2)
// =============================================================================

/**
 * Decans ring styling — boundaries + decan numbers + ruler glyphs as one ring.
 * Default: Swift `DecansStyle.default` (== Rust `DecansStyle::default()`).
 *
 * NOTE: `boundaryLineWidth` here is a LIVE field (radial lines between
 * decans), NOT the legacy alias of the same name on houses/fixedStars/
 * cuspAnnotations. Concentric edges here are `outer/innerBoundaryWidth`.
 */
export interface DecansStyle {
  $type: typeof DECANS_STYLE_TYPE;
  glyphSize: number;
  rotateGlyphs: boolean;
  glyphColor: ColorValue | undefined;
  numberFontSize: number;
  numberTextColor: ColorValue | undefined;
  boundaryLineWidth: number;
  boundaryLineColor: ColorValue | undefined;
  outerBoundaryWidth: number;
  innerBoundaryWidth: number;
  backgroundColor: ColorValue | undefined;
}

export const DECANS_STYLE_DEFAULT: DecansStyle = {
  $type: DECANS_STYLE_TYPE,
  glyphSize: 14.0,
  rotateGlyphs: false,
  glyphColor: undefined,
  numberFontSize: 10.0,
  numberTextColor: undefined,
  boundaryLineWidth: 0.5,
  boundaryLineColor: undefined,
  outerBoundaryWidth: 0.5,
  innerBoundaryWidth: 0.5,
  backgroundColor: { source: "semantic", value: "disabled", layer: "bg" },
};

export function parseDecansStyle(v: unknown): DecansStyle {
  const o = obj(v);
  const d = DECANS_STYLE_DEFAULT;
  return {
    $type: DECANS_STYLE_TYPE,
    glyphSize: num(o.glyphSize, d.glyphSize),
    rotateGlyphs: bool(o.rotateGlyphs, d.rotateGlyphs),
    glyphColor: optColor(o.glyphColor),
    numberFontSize: num(o.numberFontSize, d.numberFontSize),
    numberTextColor: optColor(o.numberTextColor),
    boundaryLineWidth: num(o.boundaryLineWidth, d.boundaryLineWidth),
    boundaryLineColor: optColor(o.boundaryLineColor),
    outerBoundaryWidth: num(o.outerBoundaryWidth, d.outerBoundaryWidth),
    innerBoundaryWidth: num(o.innerBoundaryWidth, d.innerBoundaryWidth),
    backgroundColor: optColor(o.backgroundColor),
  };
}

export function serializeDecansStyle(s: DecansStyle): unknown {
  return {
    $type: s.$type,
    glyphSize: s.glyphSize,
    rotateGlyphs: s.rotateGlyphs,
    ...optColorEntry("glyphColor", s.glyphColor),
    numberFontSize: s.numberFontSize,
    ...optColorEntry("numberTextColor", s.numberTextColor),
    boundaryLineWidth: s.boundaryLineWidth,
    ...optColorEntry("boundaryLineColor", s.boundaryLineColor),
    outerBoundaryWidth: s.outerBoundaryWidth,
    innerBoundaryWidth: s.innerBoundaryWidth,
    ...optColorEntry("backgroundColor", s.backgroundColor),
  };
}

// =============================================================================
// SignRulersStyle
// =============================================================================

/** Sign rulers ring styling. Default: Swift `SignRulersStyle.default` (== Rust). */
export interface SignRulersStyle {
  $type: typeof SIGN_RULERS_STYLE_TYPE;
  glyphSize: number;
  rotateGlyphs: boolean;
  glyphColor: ColorValue | undefined;
  boundaryLineWidth: number;
  boundaryLineColor: ColorValue | undefined;
  outerBoundaryWidth: number;
  innerBoundaryWidth: number;
  backgroundColor: ColorValue | undefined;
}

export const SIGN_RULERS_STYLE_DEFAULT: SignRulersStyle = {
  $type: SIGN_RULERS_STYLE_TYPE,
  glyphSize: 16.0,
  rotateGlyphs: false,
  glyphColor: undefined,
  boundaryLineWidth: 0.5,
  boundaryLineColor: undefined,
  outerBoundaryWidth: 0.5,
  innerBoundaryWidth: 0.5,
  backgroundColor: { source: "semantic", value: "disabled", layer: "bg" },
};

export function parseSignRulersStyle(v: unknown): SignRulersStyle {
  const o = obj(v);
  const d = SIGN_RULERS_STYLE_DEFAULT;
  return {
    $type: SIGN_RULERS_STYLE_TYPE,
    glyphSize: num(o.glyphSize, d.glyphSize),
    rotateGlyphs: bool(o.rotateGlyphs, d.rotateGlyphs),
    glyphColor: optColor(o.glyphColor),
    boundaryLineWidth: num(o.boundaryLineWidth, d.boundaryLineWidth),
    boundaryLineColor: optColor(o.boundaryLineColor),
    outerBoundaryWidth: num(o.outerBoundaryWidth, d.outerBoundaryWidth),
    innerBoundaryWidth: num(o.innerBoundaryWidth, d.innerBoundaryWidth),
    backgroundColor: optColor(o.backgroundColor),
  };
}

export function serializeSignRulersStyle(s: SignRulersStyle): unknown {
  return {
    $type: s.$type,
    glyphSize: s.glyphSize,
    rotateGlyphs: s.rotateGlyphs,
    ...optColorEntry("glyphColor", s.glyphColor),
    boundaryLineWidth: s.boundaryLineWidth,
    ...optColorEntry("boundaryLineColor", s.boundaryLineColor),
    outerBoundaryWidth: s.outerBoundaryWidth,
    innerBoundaryWidth: s.innerBoundaryWidth,
    ...optColorEntry("backgroundColor", s.backgroundColor),
  };
}

// =============================================================================
// TermsStyle
// =============================================================================

/**
 * Terms (planetary bounds) ring styling. Default: Swift `TermsStyle.default`
 * (== Rust; glyphSize 12.0 differs from SignRulersStyle's 16.0 — intentional,
 * noted on both sides). No bundled template carries a terms ring, so no
 * template wire cite; shape from TermsStyle.swift / styles.rs.
 */
export interface TermsStyle {
  $type: typeof TERMS_STYLE_TYPE;
  glyphSize: number;
  rotateGlyphs: boolean;
  glyphColor: ColorValue | undefined;
  boundaryLineWidth: number;
  boundaryLineColor: ColorValue | undefined;
  outerBoundaryWidth: number;
  innerBoundaryWidth: number;
  backgroundColor: ColorValue | undefined;
}

export const TERMS_STYLE_DEFAULT: TermsStyle = {
  $type: TERMS_STYLE_TYPE,
  glyphSize: 12.0,
  rotateGlyphs: false,
  glyphColor: undefined,
  boundaryLineWidth: 0.5,
  boundaryLineColor: undefined,
  outerBoundaryWidth: 0.5,
  innerBoundaryWidth: 0.5,
  backgroundColor: { source: "semantic", value: "disabled", layer: "bg" },
};

export function parseTermsStyle(v: unknown): TermsStyle {
  const o = obj(v);
  const d = TERMS_STYLE_DEFAULT;
  return {
    $type: TERMS_STYLE_TYPE,
    glyphSize: num(o.glyphSize, d.glyphSize),
    rotateGlyphs: bool(o.rotateGlyphs, d.rotateGlyphs),
    glyphColor: optColor(o.glyphColor),
    boundaryLineWidth: num(o.boundaryLineWidth, d.boundaryLineWidth),
    boundaryLineColor: optColor(o.boundaryLineColor),
    outerBoundaryWidth: num(o.outerBoundaryWidth, d.outerBoundaryWidth),
    innerBoundaryWidth: num(o.innerBoundaryWidth, d.innerBoundaryWidth),
    backgroundColor: optColor(o.backgroundColor),
  };
}

export function serializeTermsStyle(s: TermsStyle): unknown {
  return {
    $type: s.$type,
    glyphSize: s.glyphSize,
    rotateGlyphs: s.rotateGlyphs,
    ...optColorEntry("glyphColor", s.glyphColor),
    boundaryLineWidth: s.boundaryLineWidth,
    ...optColorEntry("boundaryLineColor", s.boundaryLineColor),
    outerBoundaryWidth: s.outerBoundaryWidth,
    innerBoundaryWidth: s.innerBoundaryWidth,
    ...optColorEntry("backgroundColor", s.backgroundColor),
  };
}

// =============================================================================
// LunarMansionsStyle
// =============================================================================

/**
 * Lunar mansions ring styling — glyph rendering (rulers mode) AND symbol
 * rendering (symbols mode); the mode itself is content-side. Default: Swift
 * `LunarMansionsStyle.default` (== Rust). Wire verified against
 * study.json `/soloChart/rings[lunarMansions]/style` (2026-08-14).
 */
export interface LunarMansionsStyle {
  $type: typeof LUNAR_MANSIONS_STYLE_TYPE;
  glyphSize: number;
  rotateGlyphs: boolean;
  glyphColor: ColorValue | undefined;
  symbolFontSize: number;
  symbolColor: ColorValue | undefined;
  boundaryLineWidth: number;
  boundaryLineColor: ColorValue | undefined;
  outerBoundaryWidth: number;
  innerBoundaryWidth: number;
  backgroundColor: ColorValue | undefined;
}

export const LUNAR_MANSIONS_STYLE_DEFAULT: LunarMansionsStyle = {
  $type: LUNAR_MANSIONS_STYLE_TYPE,
  glyphSize: 10.0,
  rotateGlyphs: false,
  glyphColor: undefined,
  symbolFontSize: 8.0,
  symbolColor: undefined,
  boundaryLineWidth: 0.5,
  boundaryLineColor: undefined,
  outerBoundaryWidth: 0.5,
  innerBoundaryWidth: 0.5,
  backgroundColor: { source: "semantic", value: "disabled", layer: "bg" },
};

export function parseLunarMansionsStyle(v: unknown): LunarMansionsStyle {
  const o = obj(v);
  const d = LUNAR_MANSIONS_STYLE_DEFAULT;
  return {
    $type: LUNAR_MANSIONS_STYLE_TYPE,
    glyphSize: num(o.glyphSize, d.glyphSize),
    rotateGlyphs: bool(o.rotateGlyphs, d.rotateGlyphs),
    glyphColor: optColor(o.glyphColor),
    symbolFontSize: num(o.symbolFontSize, d.symbolFontSize),
    symbolColor: optColor(o.symbolColor),
    boundaryLineWidth: num(o.boundaryLineWidth, d.boundaryLineWidth),
    boundaryLineColor: optColor(o.boundaryLineColor),
    outerBoundaryWidth: num(o.outerBoundaryWidth, d.outerBoundaryWidth),
    innerBoundaryWidth: num(o.innerBoundaryWidth, d.innerBoundaryWidth),
    backgroundColor: optColor(o.backgroundColor),
  };
}

export function serializeLunarMansionsStyle(s: LunarMansionsStyle): unknown {
  return {
    $type: s.$type,
    glyphSize: s.glyphSize,
    rotateGlyphs: s.rotateGlyphs,
    ...optColorEntry("glyphColor", s.glyphColor),
    symbolFontSize: s.symbolFontSize,
    ...optColorEntry("symbolColor", s.symbolColor),
    boundaryLineWidth: s.boundaryLineWidth,
    ...optColorEntry("boundaryLineColor", s.boundaryLineColor),
    outerBoundaryWidth: s.outerBoundaryWidth,
    innerBoundaryWidth: s.innerBoundaryWidth,
    ...optColorEntry("backgroundColor", s.backgroundColor),
  };
}

// =============================================================================
// FixedStarsStyle
// =============================================================================

/**
 * Fixed stars ring styling. Default: Swift `FixedStarsStyle.default`
 * (== Rust; backgroundColor nil — unique among Stage 3.5 styles).
 * Wire verified against starfield.json `/soloChart/rings[fixedStars]/style`.
 *
 * Legacy key alias (Swift `RingBoundaryLegacyAliasKeys`): a pre-split blob's
 * single `boundaryLineWidth` seeds BOTH `inner/outerBoundaryLineWidth`.
 */
export interface FixedStarsStyle {
  $type: typeof FIXED_STARS_STYLE_TYPE;
  glyphSize: number;
  rotateGlyphs: boolean;
  glyphColor: ColorValue | undefined;
  textSize: number;
  textOffset: number;
  textColor: ColorValue | undefined;
  innerBoundaryLineWidth: number;
  outerBoundaryLineWidth: number;
  boundaryLineColor: ColorValue | undefined;
  backgroundColor: ColorValue | undefined;
}

export const FIXED_STARS_STYLE_DEFAULT: FixedStarsStyle = {
  $type: FIXED_STARS_STYLE_TYPE,
  glyphSize: 14.0,
  rotateGlyphs: false,
  glyphColor: undefined,
  textSize: 8.0,
  textOffset: 4.0,
  textColor: undefined,
  innerBoundaryLineWidth: 0.5,
  outerBoundaryLineWidth: 0.5,
  boundaryLineColor: undefined,
  backgroundColor: undefined,
};

export function parseFixedStarsStyle(v: unknown): FixedStarsStyle {
  const o = obj(v);
  const d = FIXED_STARS_STYLE_DEFAULT;
  return {
    $type: FIXED_STARS_STYLE_TYPE,
    glyphSize: num(o.glyphSize, d.glyphSize),
    rotateGlyphs: bool(o.rotateGlyphs, d.rotateGlyphs),
    glyphColor: optColor(o.glyphColor),
    textSize: num(o.textSize, d.textSize),
    textOffset: num(o.textOffset, d.textOffset),
    textColor: optColor(o.textColor),
    innerBoundaryLineWidth: num(
      alias(o, "innerBoundaryLineWidth", "boundaryLineWidth"),
      d.innerBoundaryLineWidth,
    ),
    outerBoundaryLineWidth: num(
      alias(o, "outerBoundaryLineWidth", "boundaryLineWidth"),
      d.outerBoundaryLineWidth,
    ),
    boundaryLineColor: optColor(o.boundaryLineColor),
    backgroundColor: optColor(o.backgroundColor),
  };
}

export function serializeFixedStarsStyle(s: FixedStarsStyle): unknown {
  return {
    $type: s.$type,
    glyphSize: s.glyphSize,
    rotateGlyphs: s.rotateGlyphs,
    ...optColorEntry("glyphColor", s.glyphColor),
    textSize: s.textSize,
    textOffset: s.textOffset,
    ...optColorEntry("textColor", s.textColor),
    innerBoundaryLineWidth: s.innerBoundaryLineWidth,
    outerBoundaryLineWidth: s.outerBoundaryLineWidth,
    ...optColorEntry("boundaryLineColor", s.boundaryLineColor),
    ...optColorEntry("backgroundColor", s.backgroundColor),
  };
}

// =============================================================================
// CuspAnnotationsStyle
// =============================================================================

/**
 * Cusp annotations ring styling. Drops legacy `enabled`/`fontName`/
 * `colorVariant` per D8/Tasks 7-9. Default: Swift `CuspAnnotationsStyle.default`
 * (== Rust; backgroundColor secondary-bg — unique). Wire verified against
 * minimal.json `/soloChart/rings[cuspAnnotations]/style`.
 *
 * Legacy key alias (Swift `RingBoundaryLegacyAliasKeys`): a pre-split blob's
 * single `boundaryLineWidth` seeds BOTH `inner/outerBoundaryLineWidth`.
 */
export interface CuspAnnotationsStyle {
  $type: typeof CUSP_ANNOTATIONS_STYLE_TYPE;
  glyphSize: number;
  glyphColor: ColorValue | undefined;
  degreesFontSize: number;
  minutesFontSize: number;
  textColor: ColorValue | undefined;
  glyphTextSpacing: number;
  backgroundColor: ColorValue | undefined;
  boundaryLineColor: ColorValue | undefined;
  innerBoundaryLineWidth: number;
  outerBoundaryLineWidth: number;
}

export const CUSP_ANNOTATIONS_STYLE_DEFAULT: CuspAnnotationsStyle = {
  $type: CUSP_ANNOTATIONS_STYLE_TYPE,
  glyphSize: 16.0,
  glyphColor: undefined,
  degreesFontSize: 8.0,
  minutesFontSize: 8.0,
  textColor: undefined,
  glyphTextSpacing: 6.0,
  backgroundColor: { source: "semantic", value: "secondary", layer: "bg" },
  boundaryLineColor: undefined,
  innerBoundaryLineWidth: 1.0,
  outerBoundaryLineWidth: 1.0,
};

export function parseCuspAnnotationsStyle(v: unknown): CuspAnnotationsStyle {
  const o = obj(v);
  const d = CUSP_ANNOTATIONS_STYLE_DEFAULT;
  return {
    $type: CUSP_ANNOTATIONS_STYLE_TYPE,
    glyphSize: num(o.glyphSize, d.glyphSize),
    glyphColor: optColor(o.glyphColor),
    degreesFontSize: num(o.degreesFontSize, d.degreesFontSize),
    minutesFontSize: num(o.minutesFontSize, d.minutesFontSize),
    textColor: optColor(o.textColor),
    glyphTextSpacing: num(o.glyphTextSpacing, d.glyphTextSpacing),
    backgroundColor: optColor(o.backgroundColor),
    boundaryLineColor: optColor(o.boundaryLineColor),
    innerBoundaryLineWidth: num(
      alias(o, "innerBoundaryLineWidth", "boundaryLineWidth"),
      d.innerBoundaryLineWidth,
    ),
    outerBoundaryLineWidth: num(
      alias(o, "outerBoundaryLineWidth", "boundaryLineWidth"),
      d.outerBoundaryLineWidth,
    ),
  };
}

export function serializeCuspAnnotationsStyle(s: CuspAnnotationsStyle): unknown {
  return {
    $type: s.$type,
    glyphSize: s.glyphSize,
    ...optColorEntry("glyphColor", s.glyphColor),
    degreesFontSize: s.degreesFontSize,
    minutesFontSize: s.minutesFontSize,
    ...optColorEntry("textColor", s.textColor),
    glyphTextSpacing: s.glyphTextSpacing,
    ...optColorEntry("backgroundColor", s.backgroundColor),
    ...optColorEntry("boundaryLineColor", s.boundaryLineColor),
    innerBoundaryLineWidth: s.innerBoundaryLineWidth,
    outerBoundaryLineWidth: s.outerBoundaryLineWidth,
  };
}

// =============================================================================
// RingStyle union + dispatch
// =============================================================================

/** All ten ring styles parse; only five render (see header). */
export type RingStyle =
  | ZodiacRingStyle
  | PlanetsRingStyle
  | HousesRingStyle
  | AspectOverlayStyle
  | DecansStyle
  | SignRulersStyle
  | TermsStyle
  | LunarMansionsStyle
  | FixedStarsStyle
  | CuspAnnotationsStyle;

/**
 * The ring type's default style (Swift `defaultStyleAndContent(for:)`,
 * RingModule.swift:174 — every type falls back to its struct's `.default`).
 * An unknown ring type degrades to zodiac, mirroring the Swift entity
 * projection's `RingType(rawValue:) ?? .zodiac`. Returns a fresh deep copy
 * (via a serialize→parse round trip through the tested code paths).
 *
 * NOTE the deliberate distinction from the parse path: this is the STATIC
 * default (Swift `.default`), used when a blob fails entirely — so e.g.
 * `defaultRingStyle("terms").backgroundColor` is the disabled-bg semantic.
 * A WELL-FORMED blob that merely omits the key decodes it to nil instead
 * (Swift `decodeIfPresent` without `?? d.*` on the optional colors) — see
 * the terms test for the pinned difference.
 */
export function defaultRingStyle(ringType: string): RingStyle {
  switch (ringType) {
    case "planets":
      return parsePlanetsRingStyle(serializePlanetsRingStyle(PLANETS_RING_STYLE_DEFAULT));
    case "houses":
      return parseHousesRingStyle(serializeHousesRingStyle(HOUSES_RING_STYLE_DEFAULT));
    case "aspects":
      return parseAspectOverlayStyle(serializeAspectOverlayStyle(ASPECT_OVERLAY_STYLE_DEFAULT));
    case "decans":
      return parseDecansStyle(serializeDecansStyle(DECANS_STYLE_DEFAULT));
    case "signRulers":
      return parseSignRulersStyle(serializeSignRulersStyle(SIGN_RULERS_STYLE_DEFAULT));
    case "terms":
      return parseTermsStyle(serializeTermsStyle(TERMS_STYLE_DEFAULT));
    case "lunarMansions":
      return parseLunarMansionsStyle(serializeLunarMansionsStyle(LUNAR_MANSIONS_STYLE_DEFAULT));
    case "fixedStars":
      return parseFixedStarsStyle(serializeFixedStarsStyle(FIXED_STARS_STYLE_DEFAULT));
    case "cuspAnnotations":
      return parseCuspAnnotationsStyle(
        serializeCuspAnnotationsStyle(CUSP_ANNOTATIONS_STYLE_DEFAULT),
      );
    case "zodiac":
    default:
      return parseZodiacRingStyle(serializeZodiacRingStyle(ZODIAC_RING_STYLE_DEFAULT));
  }
}

/**
 * Tolerant union parse. Dispatch is on `$type` alone (Swift RingStyle.swift
 * :69-102) — a known `$type` decodes its own variant even when it mismatches
 * `ringType` (style/ring-type mismatch is a validation-tier concern, not a
 * parse-tier one). Missing/unknown `$type` degrades to `ringType`'s default.
 */
export function parseRingStyle(v: unknown, ringType: string): RingStyle {
  const t = obj(v).$type;
  switch (t) {
    case ZODIAC_STYLE_TYPE:
      return parseZodiacRingStyle(v);
    case PLANETS_STYLE_TYPE:
      return parsePlanetsRingStyle(v);
    case HOUSES_STYLE_TYPE:
      return parseHousesRingStyle(v);
    case ASPECTS_STYLE_TYPE:
      return parseAspectOverlayStyle(v);
    case DECANS_STYLE_TYPE:
      return parseDecansStyle(v);
    case SIGN_RULERS_STYLE_TYPE:
      return parseSignRulersStyle(v);
    case TERMS_STYLE_TYPE:
      return parseTermsStyle(v);
    case LUNAR_MANSIONS_STYLE_TYPE:
      return parseLunarMansionsStyle(v);
    case FIXED_STARS_STYLE_TYPE:
      return parseFixedStarsStyle(v);
    case CUSP_ANNOTATIONS_STYLE_TYPE:
      return parseCuspAnnotationsStyle(v);
    default:
      return defaultRingStyle(ringType);
  }
}

/**
 * Serialize: `$type` + fields, optional colors omitted when undefined (Swift
 * synthesized `encodeIfPresent`; Rust `skip_serializing_if`). Unknown-variant
 * passthrough is typed away but tolerated at runtime (never throws).
 */
export function serializeRingStyle(s: RingStyle): unknown {
  switch (s.$type) {
    case ZODIAC_STYLE_TYPE:
      return serializeZodiacRingStyle(s);
    case PLANETS_STYLE_TYPE:
      return serializePlanetsRingStyle(s);
    case HOUSES_STYLE_TYPE:
      return serializeHousesRingStyle(s);
    case ASPECTS_STYLE_TYPE:
      return serializeAspectOverlayStyle(s);
    case DECANS_STYLE_TYPE:
      return serializeDecansStyle(s);
    case SIGN_RULERS_STYLE_TYPE:
      return serializeSignRulersStyle(s);
    case TERMS_STYLE_TYPE:
      return serializeTermsStyle(s);
    case LUNAR_MANSIONS_STYLE_TYPE:
      return serializeLunarMansionsStyle(s);
    case FIXED_STARS_STYLE_TYPE:
      return serializeFixedStarsStyle(s);
    case CUSP_ANNOTATIONS_STYLE_TYPE:
      return serializeCuspAnnotationsStyle(s);
    default:
      return { ...(s as Record<string, unknown>) };
  }
}
