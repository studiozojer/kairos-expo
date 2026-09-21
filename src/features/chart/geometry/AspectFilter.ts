/**
 * AspectFilter — port of `AspectFilterResult.evaluate` (kairos-ios
 * `Features/ChartWheel/Aspects/Filtering/AspectFilterResult.swift`), plus the
 * quadratic bezier control-point calculation from
 * `Features/ChartWheel/Viewing/Overlays/AspectOverlay+PathCalculation.swift`
 * (`createBezierPath`'s control-point math — the path construction itself
 * stays in the render layer, `AspectOverlay.tsx`).
 *
 * SCOPE NOTE — the strength sort + `maximumAspectCount` cap are deliberately
 * NOT here: in Swift they live in `AspectOverlay.swift` (not
 * `AspectFilterResult.swift`), and the port keeps them in the render-layer
 * `AspectOverlay.tsx` for the same reason — so the Swift source stays
 * greppable file-for-file. See that file's `selectAspectsToRender`.
 *
 * Active-wheel endpoint and selection IDs are qualified by stable chart instance;
 * previews use raw engine IDs. Exact membership works for both. Ring numbers
 * are layout positions used only by interAspectsOnly, never selection identity.
 *
 * `AspectSkipReason.placementsNotFound` is carried in the union for grep
 * parity with the Swift enum, but — as in Swift — this function never
 * produces it: the placement lookup happens BEFORE `evaluate` is called (in
 * `AspectOverlay.swift`'s `guard let ... = placementMap[...] else { continue }`,
 * mirrored by `AspectOverlay.tsx`'s placement-map lookup before calling
 * `evaluateAspectFilter`).
 */

import type { AspectEdgeDTO, Placement } from "../config/engine-types";
import type { AspectConfiguration } from "../schema/preset";
import { ASPECT_TYPES, type AspectInfo } from "../schema/enums.gen";
import type { AspectOverlayStyle } from "../schema/ring-styles";
import type { Point } from "./types";

// =============================================================================
// AspectType resolution — mirrors Swift `AspectType.fromBackendName` (case-
// insensitive, hyphen/space-stripped) dispatched against enums.gen's
// ASPECT_TYPES table, whose `aliases` arrays already carry the lowercase
// wire-name aliases (codegen'd from the same source as Swift's switch).
// =============================================================================

/**
 * A resolved aspect type: the enums.gen camelCase key ("semiSextile"), the
 * canonical wire/backend name ("Semisextile" — Swift `AspectType.rawValue` /
 * `.backendName`; note the wire uses irregular casing for four types, e.g.
 * "Semisextile" not "SemiSextile"), the exact angle in degrees, and whether
 * it's a major (Ptolemaic) aspect.
 */
export interface ResolvedAspectType {
  key: string;
  wireName: string;
  angle: number;
  isMajor: boolean;
}

/** enums.gen key → canonical wire/backend name (Swift `AspectType.rawValue`). */
const ASPECT_WIRE_NAMES: Readonly<Record<string, string>> = {
  conjunction: "Conjunction",
  opposition: "Opposition",
  trine: "Trine",
  square: "Square",
  sextile: "Sextile",
  quincunx: "Quincunx",
  semiSextile: "Semisextile",
  semiSquare: "Semisquare",
  sesquiquadrate: "Sesquisquare",
  quintile: "Quintile",
  biquintile: "Biquintile",
};

/**
 * Mirror of Swift `AspectType.fromBackendName(_:)`: normalize (lowercase,
 * strip hyphens/spaces) and match against each type's key or alias list.
 * `ASPECT_TYPES[*].aliases` already includes the lowercase wire-name form
 * (e.g. "semisextile", "sesquisquare") alongside the short codes ("cnj").
 * Returns undefined for an unknown name (Swift `nil`).
 */
export function resolveAspectType(name: string): ResolvedAspectType | undefined {
  const normalized = name.toLowerCase().replace(/[-\s]/g, "");
  for (const [key, info] of Object.entries(ASPECT_TYPES) as [string, AspectInfo][]) {
    if (key.toLowerCase() === normalized || info.aliases.includes(normalized)) {
      return { key, wireName: ASPECT_WIRE_NAMES[key], angle: info.angle, isMajor: info.isMajor };
    }
  }
  return undefined;
}

// =============================================================================
// isFalseAspect — port of KairosCore `AspectType.isFalseAspect(fromLongitude:toLongitude:)`
// (swift/KairosCore/Sources/KairosCore/Support/AspectType.swift:62-86)
// =============================================================================

/**
 * True when the two bodies are in-orb for `angle` but the signs they occupy
 * don't match the aspect's expected sign relationship — e.g. an orb-legal
 * "trine" where the two placements aren't actually four signs apart.
 * Aspects that land exactly on a 30° sign boundary (conjunction, sextile,
 * square, trine, opposition, semi-sextile, semi-square, sesquiquadrate)
 * require an exact sign-distance match; aspects that don't (quintile,
 * biquintile) tolerate ±1 sign.
 */
export function isFalseAspect(angle: number, fromLongitude: number, toLongitude: number): boolean {
  const fromSign = Math.floor(fromLongitude / 30) % 12;
  const toSign = Math.floor(toLongitude / 30) % 12;

  const diff = Math.abs(fromSign - toSign);
  const actualSignDistance = Math.min(diff, 12 - diff);

  const expectedSignDistance = Math.round(angle / 30);
  const fallsOnSignBoundary = angle % 30 === 0;

  if (fallsOnSignBoundary) {
    return actualSignDistance !== expectedSignDistance;
  }
  return Math.abs(actualSignDistance - expectedSignDistance) > 1;
}

// =============================================================================
// AspectFilterResult — port of AspectFilterResult.swift
// =============================================================================

/** Mirrors Swift `AspectSkipReason`'s raw values verbatim. */
export type AspectSkipReason =
  | "placements_not_found"
  | "from_body_not_visible"
  | "to_body_not_visible"
  | "unknown_aspect_type"
  | "major_aspects_only"
  | "aspect_type_not_visible"
  | "orb_exceeds_allowed"
  | "below_minimum_strength"
  | "selection_not_matched"
  | "separating_filtered"
  | "false_aspect_filtered"
  | "inter_aspects_only";

export interface AspectFilterResult {
  shouldRender: boolean;
  skipReason: AspectSkipReason | undefined;
  aspectType: ResolvedAspectType | undefined;
}

function pass(aspectType: ResolvedAspectType): AspectFilterResult {
  return { shouldRender: true, skipReason: undefined, aspectType };
}

function skip(reason: AspectSkipReason): AspectFilterResult {
  return { shouldRender: false, skipReason: reason, aspectType: undefined };
}

export interface EvaluateAspectFilterParams {
  aspect: AspectEdgeDTO;
  fromPlacement: Placement;
  toPlacement: Placement;
  aspects: AspectConfiguration;
  style: AspectOverlayStyle;
  /** Bodies (by `Placement.bodyId`) actually rendered on the "from" side. */
  fromVisibleBodies: ReadonlySet<string>;
  /** Bodies (by `Placement.bodyId`) actually rendered on the "to" side. */
  toVisibleBodies: ReadonlySet<string>;
  /** Selected placement ids (`Placement.id` / `AspectEdgeDTO.from`/`to` space). */
  selectedIdentifiers: ReadonlySet<string>;
  ringCount: number;
  fromRing: number;
  toRing: number;
}

/**
 * Evaluate whether an aspect should be rendered, per the ten filters in
 * `AspectFilterResult.evaluate` (Swift order preserved exactly).
 */
export function evaluateAspectFilter(p: EvaluateAspectFilterParams): AspectFilterResult {
  // FILTER 1: interAspectsOnly — hide intra-ring aspects unless both
  // endpoints are selected. Solo wheel: ringCount is always 1, so this can
  // never fire (matches Swift's own single-ring behavior).
  if (p.aspects.interAspectsOnly && p.ringCount > 1 && p.fromRing === p.toRing) {
    const fromSelected = p.selectedIdentifiers.has(p.aspect.from);
    const toSelected = p.selectedIdentifiers.has(p.aspect.to);
    if (!fromSelected || !toSelected) return skip("inter_aspects_only");
  }

  // FILTER 2: visible bodies (per-side).
  if (!p.fromVisibleBodies.has(p.fromPlacement.bodyId)) return skip("from_body_not_visible");
  if (!p.toVisibleBodies.has(p.toPlacement.bodyId)) return skip("to_body_not_visible");

  // FILTER 3: resolve the aspect type.
  const aspectType = resolveAspectType(p.aspect.aspect_type);
  if (!aspectType) return skip("unknown_aspect_type");

  // FILTER 4: style-level major-aspects-only.
  if (p.style.showMajorAspectsOnly && !aspectType.isMajor) return skip("major_aspects_only");

  // FILTER 5: visible (enabled) aspect types.
  if (!p.aspects.enabledTypes.includes(aspectType.wireName)) return skip("aspect_type_not_visible");

  // FILTER 6: orb tolerance — configured orb, falling back to the type's
  // default (Swift `AspectConfiguration.orb(for:)`).
  const allowedOrb =
    p.aspects.orbs.orbs[aspectType.wireName] ?? ASPECT_TYPES[aspectType.key].defaultOrb;
  if (Math.abs(p.aspect.orb) > allowedOrb) return skip("orb_exceeds_allowed");

  // FILTER 7: minimum strength (style setting).
  if (p.aspect.strength < p.style.minimumStrength) return skip("below_minimum_strength");

  // FILTER 8: selection filtering — AND-composed with mutualAspectsOnly.
  // Empty selection is always a no-op regardless of filterBySelection.
  if (p.aspects.filterBySelection && p.selectedIdentifiers.size > 0) {
    const fromMatches = p.selectedIdentifiers.has(p.aspect.from);
    const toMatches = p.selectedIdentifiers.has(p.aspect.to);
    if (p.aspects.mutualAspectsOnly && p.selectedIdentifiers.size > 1) {
      if (!fromMatches || !toMatches) return skip("selection_not_matched");
    } else if (!fromMatches && !toMatches) {
      return skip("selection_not_matched");
    }
  }

  // FILTER 9: separating aspects.
  if (!p.aspects.showSeparatingAspects && !p.aspect.is_applying) {
    return skip("separating_filtered");
  }

  // FILTER 10: false aspects.
  if (!p.aspects.showFalseAspects) {
    if (isFalseAspect(aspectType.angle, p.fromPlacement.longitude, p.toPlacement.longitude)) {
      return skip("false_aspect_filtered");
    }
  }

  return pass(aspectType);
}

// =============================================================================
// Bezier control point — port of AspectOverlay+PathCalculation.swift's
// `createBezierPath` control-point math (the quadratic curve construction
// itself lives in AspectOverlay.tsx, alongside the straight-line/dashed/
// conjunction-marker drawing it shares a render pass with).
// =============================================================================

/**
 * The control point for a quadratic bezier between `start` and `end`,
 * curving toward/away from `center` by `curveStrength`. Mirrors Swift's
 * `mid → offset perpendicular, scaled 0.2× curveStrength` derivation exactly.
 * Returns `undefined` when `start`/`end`'s midpoint sits exactly on `center`
 * (the direction vector is undefined there) — callers fall back to a
 * straight line, same as Swift's `guard distance > 0 else { return <line> }`.
 */
export function calculateBezierControlPoint(
  start: Point,
  end: Point,
  center: Point,
  curveStrength: number,
): Point | undefined {
  const mid: Point = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };

  const dx = mid.x - center.x;
  const dy = mid.y - center.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance <= 0) return undefined;

  const unitX = dx / distance;
  const unitY = dy / distance;
  const offset = distance * curveStrength * 0.2;

  return { x: mid.x - unitX * offset, y: mid.y - unitY * offset };
}
