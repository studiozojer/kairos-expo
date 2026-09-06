/**
 * AspectFilter tests (Task 10).
 *
 * Section 1 ports `AspectFilterResultTests.swift` verbatim (5 cases,
 * `kairos-swiftTests/Features/ChartWheel/AspectFilterResultTests.swift`) —
 * same scenarios, same expected `shouldRender`/`skipReason`, translated to
 * this port's simplified (no ring-suffix, plain string-id) signature. The
 * Swift test's "sun_ring1"/"moon_ring1"/"mars_ring1" ids are kept literally:
 * Swift's `CelestialBodyIdentifier(displayID:)` parses them and compares
 * structurally, but every comparison in these scenarios has both sides
 * parsed from the SAME literal string, so plain string equality (this port)
 * and Swift's parse-then-compare agree exactly — see AspectFilter.ts's
 * module header.
 *
 * Section 2 covers the other filters directly (orb boundary, unknown/
 * disabled aspect type, false-aspect detection) — not in the Swift test
 * file, added for the self-review's edge-case checklist.
 *
 * Section 3 hand-derives the bezier control point from the Swift formula
 * (`mid - unit·(distance·curveStrength·0.2)`) for two orientations plus the
 * degenerate (start==end==center) case.
 */

import {
  calculateBezierControlPoint,
  evaluateAspectFilter,
  isFalseAspect,
  resolveAspectType,
  type EvaluateAspectFilterParams,
} from "../AspectFilter";
import type { AspectEdgeDTO, Placement } from "../../config/engine-types";
import { ASPECT_CONFIGURATION_DEFAULT, type AspectConfiguration } from "../../schema/preset";
import { ASPECT_OVERLAY_STYLE_DEFAULT } from "../../schema/ring-styles";

// ---------------------------------------------------------------------------
// Section 1 — ported AspectFilterResultTests.swift
// ---------------------------------------------------------------------------

function makePlacement(id: string, bodyId: string, longitude: number): Placement {
  return {
    id,
    bodyName: id,
    bodyId,
    longitude,
    latitude: 0,
    speedLongitude: 1,
    housePlacement: 1,
    signPlacement: "Aries",
    isRetrograde: false,
    glyphAsset: id,
  };
}

function makeAspectEdge(
  from: string,
  to: string,
  aspectType = "Conjunction",
  orb = 0,
  strength = 1,
): AspectEdgeDTO {
  return { from, to, aspect_type: aspectType, orb, strength, is_applying: true };
}

/** Swift `evaluateSunMoon` — Sun/Moon exact conjunction, both bodies visible. */
function evaluateSunMoon(filterBySelection: boolean, selectedIdentifiers: ReadonlySet<string>) {
  const sunPlacement = makePlacement("sun_ring1", "sun", 0);
  const moonPlacement = makePlacement("moon_ring1", "moon", 0);
  const aspect = makeAspectEdge("sun_ring1", "moon_ring1");
  const aspects: AspectConfiguration = {
    ...ASPECT_CONFIGURATION_DEFAULT,
    enabledTypes: ["Conjunction"],
    filterBySelection,
  };

  return evaluateAspectFilter({
    aspect,
    fromPlacement: sunPlacement,
    toPlacement: moonPlacement,
    aspects,
    style: ASPECT_OVERLAY_STYLE_DEFAULT,
    fromVisibleBodies: new Set(["sun", "moon"]),
    toVisibleBodies: new Set(["sun", "moon"]),
    selectedIdentifiers,
    ringCount: 1,
    fromRing: 1,
    toRing: 1,
  });
}

test("filterBySelection true, selected body involved: passes", () => {
  const result = evaluateSunMoon(true, new Set(["sun_ring1"]));
  expect(result.shouldRender).toBe(true);
});

test("filterBySelection true, unrelated body selected: dropped", () => {
  const result = evaluateSunMoon(true, new Set(["mars_ring1"]));
  expect(result.shouldRender).toBe(false);
  expect(result.skipReason).toBe("selection_not_matched");
});

test("filterBySelection true, no selection: no-op (renders)", () => {
  const result = evaluateSunMoon(true, new Set());
  expect(result.shouldRender).toBe(true);
});

test("filterBySelection false, unrelated body selected: still renders", () => {
  const result = evaluateSunMoon(false, new Set(["mars_ring1"]));
  expect(result.shouldRender).toBe(true);
});

test("filterBySelection false, no selection: renders (baseline)", () => {
  const result = evaluateSunMoon(false, new Set());
  expect(result.shouldRender).toBe(true);
});

// ---------------------------------------------------------------------------
// Section 2 — the other filters, edge cases
// ---------------------------------------------------------------------------

function baseParams(overrides: Partial<EvaluateAspectFilterParams> = {}): EvaluateAspectFilterParams {
  const sun = makePlacement("sun", "sun", 0);
  const moon = makePlacement("moon", "moon", 120);
  return {
    aspect: makeAspectEdge("sun", "moon", "Trine", 4, 5),
    fromPlacement: sun,
    toPlacement: moon,
    aspects: ASPECT_CONFIGURATION_DEFAULT,
    style: ASPECT_OVERLAY_STYLE_DEFAULT,
    fromVisibleBodies: new Set(["sun", "moon"]),
    toVisibleBodies: new Set(["sun", "moon"]),
    selectedIdentifiers: new Set(),
    ringCount: 1,
    fromRing: 1,
    toRing: 1,
    ...overrides,
  };
}

test("resolveAspectType is case-insensitive and matches the irregular wire spellings", () => {
  expect(resolveAspectType("Semisextile")?.key).toBe("semiSextile");
  expect(resolveAspectType("Sesquisquare")?.key).toBe("sesquiquadrate");
  expect(resolveAspectType("sesquisquare")?.key).toBe("sesquiquadrate");
  expect(resolveAspectType("nonsense")).toBeUndefined();
});

test("unknown aspect type is skipped", () => {
  const result = evaluateAspectFilter(baseParams({ aspect: makeAspectEdge("sun", "moon", "NotARealAspect") }));
  expect(result.shouldRender).toBe(false);
  expect(result.skipReason).toBe("unknown_aspect_type");
});

test("disabled (not enabled) aspect type is skipped", () => {
  const aspects: AspectConfiguration = { ...ASPECT_CONFIGURATION_DEFAULT, enabledTypes: ["Square"] };
  const result = evaluateAspectFilter(baseParams({ aspects }));
  expect(result.shouldRender).toBe(false);
  expect(result.skipReason).toBe("aspect_type_not_visible");
});

test("orb boundary: exactly at the allowed orb passes, one hair over fails", () => {
  // Trine default orb is 8.0 (ASPECT_ORBS_DEFAULT).
  const atBoundary = evaluateAspectFilter(baseParams({ aspect: makeAspectEdge("sun", "moon", "Trine", 8.0, 5) }));
  expect(atBoundary.shouldRender).toBe(true);

  const overBoundary = evaluateAspectFilter(
    baseParams({ aspect: makeAspectEdge("sun", "moon", "Trine", 8.01, 5) }),
  );
  expect(overBoundary.shouldRender).toBe(false);
  expect(overBoundary.skipReason).toBe("orb_exceeds_allowed");
});

test("a body absent from the visible set is skipped", () => {
  const result = evaluateAspectFilter(baseParams({ fromVisibleBodies: new Set(["moon"]) }));
  expect(result.shouldRender).toBe(false);
  expect(result.skipReason).toBe("from_body_not_visible");
});

test("isFalseAspect: an exact trine (120°, 4 signs apart) is not false", () => {
  expect(isFalseAspect(120, 0, 120)).toBe(false);
});

test("isFalseAspect: in-orb 'trine' whose signs are only 3 apart is false", () => {
  // Sun at 25° Aries (sign 0), Moon at 95° Cancer (sign 3, not 4 signs away) —
  // orb-legal as a trine but signs don't match the expected 4-sign distance.
  expect(isFalseAspect(120, 25, 95)).toBe(true);
});

test("showFalseAspects: false drops a false aspect that would otherwise pass every other filter", () => {
  const aspects: AspectConfiguration = { ...ASPECT_CONFIGURATION_DEFAULT, showFalseAspects: false };
  const fromPlacement = makePlacement("sun", "sun", 25);
  const toPlacement = makePlacement("moon", "moon", 95);
  const result = evaluateAspectFilter(
    baseParams({
      aspects,
      fromPlacement,
      toPlacement,
      aspect: makeAspectEdge("sun", "moon", "Trine", 5, 5),
    }),
  );
  expect(result.shouldRender).toBe(false);
  expect(result.skipReason).toBe("false_aspect_filtered");
});

// ---------------------------------------------------------------------------
// Section 3 — bezier control point, hand-derived from the Swift formula
// ---------------------------------------------------------------------------

test("bezier control point: horizontal chord curving toward center below it", () => {
  // start=(0,0) end=(100,0) center=(50,50) curveStrength=0.3
  // mid=(50,0); dx=0,dy=-50; distance=50; unit=(0,-1)
  // offset = 50 * 0.3 * 0.2 = 3
  // control = mid - unit*offset = (50 - 0*3, 0 - (-1*3)) = (50, 3)
  const control = calculateBezierControlPoint({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 50 }, 0.3);
  expect(control).toBeDefined();
  expect(control!.x).toBeCloseTo(50);
  expect(control!.y).toBeCloseTo(3);
});

test("bezier control point: vertical chord curving toward center to its right", () => {
  // start=(0,0) end=(0,100) center=(50,50) curveStrength=0.3
  // mid=(0,50); dx=-50,dy=0; distance=50; unit=(-1,0)
  // offset = 3
  // control = mid - unit*offset = (0 - (-1*3), 50 - 0*3) = (3, 50)
  const control = calculateBezierControlPoint({ x: 0, y: 0 }, { x: 0, y: 100 }, { x: 50, y: 50 }, 0.3);
  expect(control).toBeDefined();
  expect(control!.x).toBeCloseTo(3);
  expect(control!.y).toBeCloseTo(50);
});

test("bezier control point: degenerate when the chord's midpoint sits on the center", () => {
  const control = calculateBezierControlPoint({ x: 40, y: 40 }, { x: 60, y: 60 }, { x: 50, y: 50 }, 0.3);
  expect(control).toBeUndefined();
});
