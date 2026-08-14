/**
 * ChartConfigurationScaler — per-style scale appliers.
 *
 * Mirrors kairos-ios `.../Viewing/Builders/ChartConfigurationScaler.swift`
 * and the per-style `scaled(for:)` extensions in
 * `Core/Models/ChartStyle/<Style>+Render.swift` (+ KairosCore's
 * `OverlapPreventionConfigV3.scaled(by:)`, PlanetsRingStyle.swift:60).
 *
 * This module owns the design §2 `ChartConfigurationScaler` semantic:
 * **numeric sizes scale (× scale), booleans and colors never do** — and no
 * ring component ever scales ad hoc. Each applier takes the PRECOMPUTED
 * scale factor (`DisplayScaleProvider.scale(canvasSize)`); Swift's
 * `scaled(for: canvasSize)` computes the factor internally instead.
 *
 * Fields that look like sizes but deliberately DON'T scale (surprises,
 * cross-checked 2026-08-14):
 *  - `ZodiacRingStyle.majorMarkInterval` / `minorMarkInterval` — DEGREES
 *    between tick marks, not point sizes.
 *  - `AspectOverlayStyle.opacity` / `bezierCurveStrength` /
 *    `minimumStrength` / `maximumAspectCount` — unitless proportions and a
 *    count. (`dashPattern` DOES scale — its entries are point lengths.)
 *  - `OverlapPreventionConfig.nudgeDistance` scales; `enabled` doesn't.
 *  - `GlobalChartVariables.staticOrientationDegree` (degrees) and
 *    `variableRingSizing` (enum) don't; `margin`, `minimumInnerRadius`,
 *    `ringGap`, `defaultHitRadius`, and every `moduleHitRadiusOverrides`
 *    value do.
 *  - `RingThickness`: only `fixed` values scale; `auto` passes through
 *    (sizing is done downstream by the variable-ring strategy).
 *
 * Swift styles with NO `scaled()` (pass-throughs, mirrored below):
 *  - `EmptyRingStyle` — `ChartConfigurationScaler.swift:86` passes it
 *    through with the comment "Empty style has no sizing" (inaccurate — it
 *    HAS `boundaryLineWidth` — but the pass-through is the semantic). The
 *    TS schema has no empty-ring style variant, so there is nothing to
 *    export; noted here for the record.
 *  - `SelectionStyleOverride` — "Selection style doesn't need scaling"
 *    (`ChartConfigurationScaler.swift:102`); its numerics are opacities and
 *    an orb in degrees, all canvas-invariant. Exported as a pass-through
 *    for interface uniformity.
 *
 * Swift render-variant note for Tasks 7/8: the Swift `RingStyleVariant`
 * enum's `houseNumbers` case carries a **ZodiacRingStyle** (not
 * HousesRingStyle) and has an `empty(EmptyRingStyle)` case — the wire-level
 * union mirrored in schema/ring-styles.ts has neither. `scaleRingStyle`
 * below dispatches on the TS union's `$type`.
 */

import {
  type GlobalChartVariables,
  type OverlapPreventionConfig,
  type RingThickness,
} from "../schema/core-types";
import type { SelectionStyleOverride } from "../schema/preset";
import {
  ASPECTS_STYLE_TYPE,
  CUSP_ANNOTATIONS_STYLE_TYPE,
  DECANS_STYLE_TYPE,
  FIXED_STARS_STYLE_TYPE,
  HOUSES_STYLE_TYPE,
  LUNAR_MANSIONS_STYLE_TYPE,
  PLANETS_STYLE_TYPE,
  SIGN_RULERS_STYLE_TYPE,
  TERMS_STYLE_TYPE,
  ZODIAC_STYLE_TYPE,
  type AspectOverlayStyle,
  type CuspAnnotationsStyle,
  type DecansStyle,
  type FixedStarsStyle,
  type HousesRingStyle,
  type LunarMansionsStyle,
  type PlanetsRingStyle,
  type RingStyle,
  type SignRulersStyle,
  type TermsStyle,
  type ZodiacRingStyle,
} from "../schema/ring-styles";

// =============================================================================
// Shared helpers
// =============================================================================

/**
 * Mirror of KairosCore `OverlapPreventionConfigV3.scaled(by:)`:
 * `nudgeDistance` scales (absolute-point semantics at design-reference
 * scale); `enabled` is canvas-invariant.
 */
export function scaleOverlapPrevention(
  c: OverlapPreventionConfig,
  scale: number,
): OverlapPreventionConfig {
  return { enabled: c.enabled, nudgeDistance: c.nudgeDistance * scale };
}

/**
 * Mirror of `RingThickness+Render.swift`: `.fixed` values scale; `.auto`
 * returns unchanged (sizing is done downstream by the variable-ring
 * strategy).
 */
export function scaleRingThickness(t: RingThickness, scale: number): RingThickness {
  return t.kind === "fixed" ? { kind: "fixed", value: t.value * scale } : t;
}

// =============================================================================
// Per-style appliers (one per Swift struct's `scaled(for:)`)
// =============================================================================

/** ZodiacRingStyle+Render.swift. Mark INTERVALS are degrees — not scaled. */
export function scaleZodiacRingStyle(s: ZodiacRingStyle, scale: number): ZodiacRingStyle {
  return {
    ...s,
    glyphSize: s.glyphSize * scale,
    segmentBorderWidth: s.segmentBorderWidth * scale,
    radialLineWidth: s.radialLineWidth * scale,
    majorMarkLength: s.majorMarkLength * scale,
    minorMarkLength: s.minorMarkLength * scale,
    majorMarkWidth: s.majorMarkWidth * scale,
    minorMarkWidth: s.minorMarkWidth * scale,
  };
}

/** PlanetsRingStyle+Render.swift (`showFrameDerivedPoints` is canvas-invariant). */
export function scalePlanetsRingStyle(s: PlanetsRingStyle, scale: number): PlanetsRingStyle {
  return {
    ...s,
    glyphSize: s.glyphSize * scale,
    circleRadius: s.circleRadius * scale,
    degreeTextFontSize: s.degreeTextFontSize * scale,
    degreeTextOffset: s.degreeTextOffset * scale,
    degreeTextLineSpacing: s.degreeTextLineSpacing * scale,
    degreeMarkLength: s.degreeMarkLength * scale,
    degreeMarkWidth: s.degreeMarkWidth * scale,
    connectionLineWidth: s.connectionLineWidth * scale,
    glyphInsetFromAnchor: s.glyphInsetFromAnchor * scale,
    innerBoundaryLineWidth: s.innerBoundaryLineWidth * scale,
    outerBoundaryLineWidth: s.outerBoundaryLineWidth * scale,
    overlapPrevention: scaleOverlapPrevention(s.overlapPrevention, scale),
    cuspLineWidth: s.cuspLineWidth * scale,
    angularCuspLineWidth: s.angularCuspLineWidth * scale,
  };
}

/** HousesRingStyle+Render.swift. */
export function scaleHousesRingStyle(s: HousesRingStyle, scale: number): HousesRingStyle {
  return {
    ...s,
    numberFontSize: s.numberFontSize * scale,
    cuspLineWidth: s.cuspLineWidth * scale,
    angularCuspLineWidth: s.angularCuspLineWidth * scale,
    innerBoundaryLineWidth: s.innerBoundaryLineWidth * scale,
    outerBoundaryLineWidth: s.outerBoundaryLineWidth * scale,
  };
}

/**
 * AspectOverlayStyle+Render.swift. `opacity`, `bezierCurveStrength`,
 * `minimumStrength`, `maximumAspectCount` are unitless — not scaled;
 * `dashPattern` entries are point lengths — scaled.
 */
export function scaleAspectOverlayStyle(s: AspectOverlayStyle, scale: number): AspectOverlayStyle {
  return {
    ...s,
    lineWidth: s.lineWidth * scale,
    dashPattern: s.dashPattern.map((d) => d * scale),
  };
}

/** DecansStyle+Render.swift. */
export function scaleDecansStyle(s: DecansStyle, scale: number): DecansStyle {
  return {
    ...s,
    glyphSize: s.glyphSize * scale,
    numberFontSize: s.numberFontSize * scale,
    boundaryLineWidth: s.boundaryLineWidth * scale,
    outerBoundaryWidth: s.outerBoundaryWidth * scale,
    innerBoundaryWidth: s.innerBoundaryWidth * scale,
  };
}

/** SignRulersStyle+Render.swift. */
export function scaleSignRulersStyle(s: SignRulersStyle, scale: number): SignRulersStyle {
  return {
    ...s,
    glyphSize: s.glyphSize * scale,
    boundaryLineWidth: s.boundaryLineWidth * scale,
    outerBoundaryWidth: s.outerBoundaryWidth * scale,
    innerBoundaryWidth: s.innerBoundaryWidth * scale,
  };
}

/** TermsStyle+Render.swift. */
export function scaleTermsStyle(s: TermsStyle, scale: number): TermsStyle {
  return {
    ...s,
    glyphSize: s.glyphSize * scale,
    boundaryLineWidth: s.boundaryLineWidth * scale,
    outerBoundaryWidth: s.outerBoundaryWidth * scale,
    innerBoundaryWidth: s.innerBoundaryWidth * scale,
  };
}

/** LunarMansionsStyle+Render.swift. */
export function scaleLunarMansionsStyle(s: LunarMansionsStyle, scale: number): LunarMansionsStyle {
  return {
    ...s,
    glyphSize: s.glyphSize * scale,
    symbolFontSize: s.symbolFontSize * scale,
    boundaryLineWidth: s.boundaryLineWidth * scale,
    outerBoundaryWidth: s.outerBoundaryWidth * scale,
    innerBoundaryWidth: s.innerBoundaryWidth * scale,
  };
}

/** FixedStarsStyle+Render.swift. */
export function scaleFixedStarsStyle(s: FixedStarsStyle, scale: number): FixedStarsStyle {
  return {
    ...s,
    glyphSize: s.glyphSize * scale,
    textSize: s.textSize * scale,
    textOffset: s.textOffset * scale,
    innerBoundaryLineWidth: s.innerBoundaryLineWidth * scale,
    outerBoundaryLineWidth: s.outerBoundaryLineWidth * scale,
  };
}

/** CuspAnnotationsStyle+Render.swift. */
export function scaleCuspAnnotationsStyle(
  s: CuspAnnotationsStyle,
  scale: number,
): CuspAnnotationsStyle {
  return {
    ...s,
    glyphSize: s.glyphSize * scale,
    degreesFontSize: s.degreesFontSize * scale,
    minutesFontSize: s.minutesFontSize * scale,
    glyphTextSpacing: s.glyphTextSpacing * scale,
    innerBoundaryLineWidth: s.innerBoundaryLineWidth * scale,
    outerBoundaryLineWidth: s.outerBoundaryLineWidth * scale,
  };
}

/** GlobalChartVariables+Render.swift. */
export function scaleGlobalChartVariables(
  g: GlobalChartVariables,
  scale: number,
): GlobalChartVariables {
  const scaledOverrides: Record<string, number> = {};
  for (const [key, value] of Object.entries(g.moduleHitRadiusOverrides)) {
    scaledOverrides[key] = value * scale;
  }
  return {
    ...g,
    margin: g.margin * scale,
    minimumInnerRadius: g.minimumInnerRadius * scale,
    ringGap: g.ringGap * scale,
    defaultHitRadius: g.defaultHitRadius * scale,
    moduleHitRadiusOverrides: scaledOverrides,
    overlapPrevention: scaleOverlapPrevention(g.overlapPrevention, scale),
  };
}

/**
 * Pass-through for interface uniformity: Swift's `SelectionStyleOverride`
 * has no `scaled()` — "Selection style doesn't need scaling"
 * (ChartConfigurationScaler.swift:102). Its numerics (opacities, orb in
 * degrees) are canvas-invariant. Returns the input unchanged.
 */
export function scaleSelectionStyleOverride(
  s: SelectionStyleOverride,
  _scale: number,
): SelectionStyleOverride {
  return s;
}

// =============================================================================
// RingStyle union dispatch (mirror of the Swift scaler's private scaleRingStyle)
// =============================================================================

/**
 * Dispatch on the `$type` discriminator. Swift's `.empty(EmptyRingStyle)`
 * pass-through has no TS counterpart (the wire schema has no empty-ring
 * style variant — see the file header).
 */
export function scaleRingStyle(style: RingStyle, scale: number): RingStyle {
  switch (style.$type) {
    case ZODIAC_STYLE_TYPE:
      return scaleZodiacRingStyle(style, scale);
    case PLANETS_STYLE_TYPE:
      return scalePlanetsRingStyle(style, scale);
    case HOUSES_STYLE_TYPE:
      return scaleHousesRingStyle(style, scale);
    case ASPECTS_STYLE_TYPE:
      return scaleAspectOverlayStyle(style, scale);
    case DECANS_STYLE_TYPE:
      return scaleDecansStyle(style, scale);
    case SIGN_RULERS_STYLE_TYPE:
      return scaleSignRulersStyle(style, scale);
    case TERMS_STYLE_TYPE:
      return scaleTermsStyle(style, scale);
    case LUNAR_MANSIONS_STYLE_TYPE:
      return scaleLunarMansionsStyle(style, scale);
    case FIXED_STARS_STYLE_TYPE:
      return scaleFixedStarsStyle(style, scale);
    case CUSP_ANNOTATIONS_STYLE_TYPE:
      return scaleCuspAnnotationsStyle(style, scale);
  }
}
