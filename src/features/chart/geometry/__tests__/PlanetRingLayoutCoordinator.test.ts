/**
 * PlanetRingLayoutCoordinator tests — translated VERBATIM from
 * kairos-swiftTests/Features/ChartWheel/Layout/PlanetRingLayoutCoordinatorTests.swift
 * (413 lines, 14 test functions — the last loops all 8
 * (anchor × invert × tickBoth) cells).
 *
 * Validates planet radius across (anchorFromInnerEdge ×
 * invertGlyphOrder × showTicksOnBothEdges) combinations.
 *
 * Translation notes (Task 6):
 *  - Hand-computed expected radii (168, 152) are the Swift values, verbatim:
 *    outerRadius=180, innerRadius=140, mark=4, glyphInsetFromAnchor=8.
 *  - Swift `visibleBodies: Set<CelestialBody>` → `Set<string>` of body names
 *    ("sun" / "moon" / "mercury"); placements carry `body` matching.
 *  - `#expect(abs(x − v) < 0.01)` → `expect(Math.abs(x − v) < 0.01).toBe(true)`.
 */

import { PlanetRingLayoutCoordinator } from "../PlanetRingLayoutCoordinator";
import type { PlanetLayoutPosition } from "../PlanetLayoutEngine";
import type { ChartPlacement } from "../PlanetLayoutEngine";
import { ChartCoordinateSystem } from "../ChartCoordinateSystem";
import { RingGeometry } from "../RingGeometry";
import {
  PLANETS_RING_STYLE_DEFAULT,
  type PlanetsRingStyle,
} from "../../schema/ring-styles";
import type { Point } from "../types";

// MARK: - Helpers

function placement(longitude: number = 0): ChartPlacement {
  return {
    id: "sun",
    body: "sun",
    longitude,
    isRetrograde: false,
  };
}

/// Distinct-body placement helper for multi-placement tests. The default
/// `placement(longitude)` always returns a Sun placement, which would
/// collapse to one visible body when filtered by `visibleBodies`. This
/// variant lets a test scatter different bodies across longitudes.
function placementForBody(body: string, longitude: number): ChartPlacement {
  return {
    id: body,
    body,
    longitude,
    isRetrograde: false,
  };
}

function makeGeometry(): RingGeometry {
  // Swift: RingGeometry(canvasSize: 400×400, centerPoint: (200,200),
  // outerRadius: 180, ringThicknesses: [40], ringGap: 2). TS RingGeometry
  // dropped canvasSize/centerPoint (ChartCoordinateSystem owns the center).
  return new RingGeometry(180, [40], 2);
}

function makeCoordinates(): ChartCoordinateSystem {
  return new ChartCoordinateSystem({ x: 200, y: 200 }, 0);
}

/// degreeMarkLength=4, glyphInsetFromAnchor=8 so radius arithmetic is
/// easy to verify (clearance=12 when tick-on-planet-side, else 8).
function makeStyle(anchor: boolean, invert: boolean, tickBoth: boolean): PlanetsRingStyle {
  return {
    ...PLANETS_RING_STYLE_DEFAULT,
    anchorFromInnerEdge: anchor,
    invertGlyphOrder: invert,
    showTicksOnBothEdges: tickBoth,
    degreeMarkLength: 4,
    glyphInsetFromAnchor: 8,
    overlapPrevention: { enabled: false, nudgeDistance: 0 },
  };
}

/// Variant of makeStyle with overlap prevention enabled. Used by the
/// overlap-prevented-path coverage tests below.
function makeStyleWithOverlapPrevention(
  anchor: boolean,
  invert: boolean,
  tickBoth: boolean,
  nudgeDistance: number = 4,
): PlanetsRingStyle {
  const style = makeStyle(anchor, invert, tickBoth);
  return { ...style, overlapPrevention: { enabled: true, nudgeDistance } };
}

/// Variant of runCoordinator that returns all positions (not just first).
/// Used for multi-placement overlap-path tests.
function runCoordinatorMulti(
  placements: ChartPlacement[],
  bodies: Set<string>,
  style: PlanetsRingStyle,
): PlanetLayoutPosition[] {
  const coord = new PlanetRingLayoutCoordinator(
    placements,
    0, // ringIndex
    1, // chartRingNumber
    1, // maxRingNumber
    makeGeometry(),
    makeCoordinates(),
    style,
    style.overlapPrevention,
    bodies,
    [], // selections
  );
  return coord.calculateLayout();
}

function runCoordinator(style: PlanetsRingStyle): PlanetLayoutPosition {
  const results = runCoordinatorMulti([placement()], new Set(["sun"]), style);
  return results[0];
}

function radius(ofPoint: Point): number {
  const dx = ofPoint.x - 200;
  const dy = ofPoint.y - 200;
  return Math.sqrt(dx * dx + dy * dy);
}

// MARK: - Tests
// outerRadius=180, innerRadius=140, mark=4, glyphInsetFromAnchor=8.
// Anchor-tied semantic (2026-05-31): planet radius = stackAnchorEnd +
// direction * (invert ? stackTailOffset : 0). With no labels visible
// (default fixture), stackTailOffset = 0 so invert has no effect on
// the planet's radial position; planet always sits at stackAnchorEnd.

/// anchor=F (outer), invert=F, no labels:
/// stackAnchorEnd = 180 - 4 - 8 = 168. Planet at 168.
test("radius_anchorOuter_invertFalse_noLabels", () => {
  const style = makeStyle(false, false, false);
  const result = runCoordinator(style);
  expect(Math.abs(radius(result.originalPosition) - 168) < 0.01).toBe(true);
});

/// anchor=T (inner), invert=F, no labels:
/// stackAnchorEnd = 140 + 4 + 8 = 152. Planet at 152.
test("radius_anchorInner_invertFalse_noLabels", () => {
  const style = makeStyle(true, false, false);
  const result = runCoordinator(style);
  expect(Math.abs(radius(result.originalPosition) - 152) < 0.01).toBe(true);
});

/// anchor=F (outer), invert=T, no labels: same as invert=F when no labels
/// (stackTailOffset = 0 → invert has no effect).
/// stackAnchorEnd = 168. Planet at 168.
test("radius_anchorOuter_invertTrue_noLabels", () => {
  const style = makeStyle(false, true, false);
  const result = runCoordinator(style);
  expect(Math.abs(radius(result.originalPosition) - 168) < 0.01).toBe(true);
});

/// anchor=T (inner), invert=T, no labels: same as invert=F when no labels.
/// stackAnchorEnd = 152. Planet at 152.
test("radius_anchorInner_invertTrue_noLabels", () => {
  const style = makeStyle(true, true, false);
  const result = runCoordinator(style);
  expect(Math.abs(radius(result.originalPosition) - 152) < 0.01).toBe(true);
});

/// tick-both=T, anchor=F (outer), invert=F: showTicksOnBothEdges has no
/// effect on inset semantics (anchor's tick is still the reference).
/// stackAnchorEnd = 168. Planet at 168.
test("radius_anchorOuter_invertFalse_tickBoth", () => {
  const style = makeStyle(false, false, true);
  const result = runCoordinator(style);
  expect(Math.abs(radius(result.originalPosition) - 168) < 0.01).toBe(true);
});

/// tick-both=T, anchor=F (outer), invert=T: same as invert=F when no labels.
/// stackAnchorEnd = 168. Planet at 168.
test("radius_anchorOuter_invertTrue_tickBoth", () => {
  const style = makeStyle(false, true, true);
  const result = runCoordinator(style);
  expect(Math.abs(radius(result.originalPosition) - 168) < 0.01).toBe(true);
});

/// Invert is observable when the stack has visible labels — verify the
/// far-side placement here, with degreeText + signGlyph visible.
/// anchor=T (inner), invert=T, labels visible:
/// stackAnchorEnd = 152, stackTailOffset > 0 (the actual value depends on
/// font + spacing config; we assert it's strictly greater than the no-
/// label case rather than pinning to an exact font-dependent value).
test("radius_invertedWithLabels_landsAtFarSideEnd", () => {
  const styleNoLabels = makeStyle(true, true, false);
  const styleWithLabels: PlanetsRingStyle = {
    ...styleNoLabels,
    showDegreeText: true,
    showSignGlyph: true,
  };

  const rNo = radius(runCoordinator(styleNoLabels).originalPosition);
  const rWith = radius(runCoordinator(styleWithLabels).originalPosition);

  // anchor=inner, invert=true → planet at far-side (outward).
  // Adding labels should push planet outward (toward outer edge).
  expect(rWith > rNo).toBe(true);
  // "labels-visible invert=true should place planet further outward than no-labels case"
});

// MARK: - Connection-line endpoint
//
// Under the anchor-tied semantic (2026-05-31), the endpoint logic remains:
// when invertGlyphOrder=true the planet is at the far-side end of the
// stack from the anchor, and the connection line terminates at the stack
// tail on the anchor side (rather than at the planet, which would draw
// through the stack redundantly). The condition restates as a single flag
// check on invertGlyphOrder; the geometric form is unchanged.

/// Returns true when `a` and `b` are colinear with the chart center.
function sameDirection(a: Point, b: Point): boolean {
  const aAngle = Math.atan2(a.y - 200, a.x - 200);
  const bAngle = Math.atan2(b.y - 200, b.x - 200);
  return Math.abs(aAngle - bAngle) < 0.0001;
}

/// invertGlyphOrder=false → planet is at the anchor-side end of stack →
/// connection endpoint = planet center.
test("endpoint_invertFalse_returnsPlanetCenter", () => {
  const style: PlanetsRingStyle = {
    ...makeStyle(true, false, false),
    showDegreeText: true,
    showSignGlyph: true,
  };
  const result = runCoordinator(style);
  expect(Math.abs(result.connectionEndpoint.x - result.originalPosition.x) < 0.01).toBe(true);
  expect(Math.abs(result.connectionEndpoint.y - result.originalPosition.y) < 0.01).toBe(true);
});

/// invertGlyphOrder=true with labels visible → planet is at far-side end
/// of stack → connection endpoint = stack tail on the anchor side. The
/// endpoint is along the same radial direction as the planet, displaced
/// inward (toward anchor) by stackTailOffset.
test("endpoint_invertTrue_anchorInner_terminatesAtStackTail", () => {
  const style: PlanetsRingStyle = {
    ...makeStyle(true, true, false),
    showDegreeText: true,
    showSignGlyph: true,
    showMinuteText: true,
  };
  const result = runCoordinator(style);

  const planetR = radius(result.originalPosition);
  const endpointR = radius(result.connectionEndpoint);

  // anchor=inner, invert=true → planet outward, endpoint inward toward anchor.
  expect(endpointR < planetR).toBe(true);
  // "endpoint should be inward of planet when anchor=inner, invert=true"
  expect(sameDirection(result.connectionEndpoint, result.originalPosition)).toBe(true);
});

/// Symmetric case: anchor=outer, invert=true. Planet is at far-side end
/// (inner side); endpoint terminates at stack tail on outer side.
test("endpoint_invertTrue_anchorOuter_terminatesAtStackTail", () => {
  const style: PlanetsRingStyle = {
    ...makeStyle(false, true, false),
    showDegreeText: true,
    showSignGlyph: true,
    showMinuteText: true,
  };
  const result = runCoordinator(style);

  const planetR = radius(result.originalPosition);
  const endpointR = radius(result.connectionEndpoint);

  expect(endpointR > planetR).toBe(true);
  // "endpoint should be outward of planet when anchor=outer, invert=true"
  expect(sameDirection(result.connectionEndpoint, result.originalPosition)).toBe(true);
});

/// invertGlyphOrder=true but no stack elements visible → stackTailOffset
/// = 0, planet IS the stack → endpoint falls back to planet center.
test("endpoint_invertTrue_noStackVisible_fallsBackToPlanetCenter", () => {
  const style = makeStyle(true, true, false);
  // All show* flags default false from PlanetsRingStyle.default
  const result = runCoordinator(style);
  expect(Math.abs(result.connectionEndpoint.x - result.originalPosition.x) < 0.01).toBe(true);
  expect(Math.abs(result.connectionEndpoint.y - result.originalPosition.y) < 0.01).toBe(true);
});

// MARK: - Overlap-prevented path coverage

/// In the no-overlap case (placements far apart), both paths must produce
/// the same planet radii — both compute via Self.planetRadius. This is a
/// regression guard against the two paths diverging on the radial axis.
test("overlapPrevented_andExact_produceSameRadii_whenNoOverlap", () => {
  const p1 = placementForBody("sun", 0);
  const p2 = placementForBody("moon", 180); // diametrically opposite — no overlap

  const exactStyle = makeStyle(true, false, false);
  const preventedStyle = makeStyleWithOverlapPrevention(true, false, false);

  const exact = runCoordinatorMulti([p1, p2], new Set(["sun", "moon"]), exactStyle);
  const prevented = runCoordinatorMulti([p1, p2], new Set(["sun", "moon"]), preventedStyle);

  for (let i = 0; i < exact.length; i++) {
    const er = radius(exact[i].originalPosition);
    const pr = radius(prevented[i].originalPosition);
    expect(Math.abs(er - pr) < 0.01).toBe(true);
    // "exact and prevented paths produced different radii"
  }
});

/// Overlap-prevented path: clustered placements should produce visible
/// angular nudging but identical radial positions (the radial dimension
/// goes through Self.planetRadius unchanged regardless of overlap).
test("overlapPrevented_clusteredPlacements_nudgeAngularlyOnly", () => {
  // Three different bodies at adjacent longitudes — tight enough to
  // overlap at default glyph size.
  const placements = [
    placementForBody("sun", 0),
    placementForBody("moon", 2),
    placementForBody("mercury", 4),
  ];
  const style = makeStyleWithOverlapPrevention(true, false, false);
  const positions = runCoordinatorMulti(
    placements,
    new Set(["sun", "moon", "mercury"]),
    style,
  );

  // All radii should be identical (nudging happens on the angular axis only).
  const radii = positions.map((p) => radius(p.adjustedPosition));
  expect(radii.length === 3).toBe(true);
  if (radii.length === 3) {
    expect(Math.abs(radii[0] - radii[1]) < 0.01).toBe(true); // "radii differ across placements"
    expect(Math.abs(radii[1] - radii[2]) < 0.01).toBe(true); // "radii differ across placements"
  }

  // And nudging actually happened: at least one adjustedPosition must
  // differ angularly from its originalPosition. Without this assertion,
  // a pathological implementation that skipped nudging entirely would
  // still satisfy the radii-equal check above.
  const angle = (p: Point): number => Math.atan2(p.y - 200, p.x - 200);
  const anyNudged = positions.some(
    (position) =>
      Math.abs(angle(position.adjustedPosition) - angle(position.originalPosition)) > 0.0001,
  );
  expect(anyNudged).toBe(true);
  // "expected angular nudging for clustered placements; none observed"
});

/// Overlap-prevented path uses the same anchor-tied semantic as the exact
/// path: the same expected planet radius for a single placement.
test("overlapPrevented_singlePlacement_matchesAnchorTiedFormula", () => {
  const style = makeStyleWithOverlapPrevention(true, false, false);
  const results = runCoordinatorMulti(
    [placementForBody("sun", 0)],
    new Set(["sun"]),
    style,
  );
  // Fail cleanly (vs crash) if the visibleBodies filter silently drops
  // the placement — that would be a body-id-match regression worth
  // surfacing as a test failure, not a force-unwrap crash.
  const result = results[0];
  if (result === undefined) {
    throw new Error("expected 1 placement to survive visibleBodies filter; got 0");
  }
  // stackAnchorEnd = 140 + 4 + 8 = 152. Planet at 152.
  expect(Math.abs(radius(result.originalPosition) - 152) < 0.01).toBe(true);
});

// MARK: - Direction-of-effect consistency (anchor-tied semantic)

/// The load-bearing user-facing invariant of the anchor-tied semantic:
/// increasing `glyphInsetFromAnchor` always pushes the planet's radial
/// position further from the anchor edge, regardless of any combination
/// of (anchor × invertGlyphOrder × showTicksOnBothEdges).
///
/// "Further from anchor edge":
///   - anchor=inner → planet radius increases (outward)
///   - anchor=outer → planet radius decreases (inward)
///
/// Under the pre-anchor-tied semantic this property fails in the cells
/// where the inset was measured from a bare edge (the planet's own edge,
/// when no tick was on the planet's side) — increasing the inset pushed
/// the planet *toward* the anchor. The anchor-tied semantic eliminates
/// those cases.
test("directionOfEffectIsConsistentAcrossAllCells", () => {
  for (const anchor of [false, true]) {
    for (const invert of [false, true]) {
      for (const tickBoth of [false, true]) {
        const styleLo: PlanetsRingStyle = {
          ...makeStyle(anchor, invert, tickBoth),
          glyphInsetFromAnchor: 4,
        };
        const styleHi: PlanetsRingStyle = { ...styleLo, glyphInsetFromAnchor: 12 };

        const rLo = radius(runCoordinator(styleLo).originalPosition);
        const rHi = radius(runCoordinator(styleHi).originalPosition);

        const expectedSign = anchor ? +1 : -1; // anchor=inner → outward; anchor=outer → inward
        const actualSign = rHi > rLo ? +1 : rHi < rLo ? -1 : 0;

        expect(actualSign === expectedSign).toBe(true);
        // "anchor=\(anchor), invert=\(invert), tickBoth=\(tickBoth): expected sign \(expectedSign), got \(actualSign)"
      }
    }
  }
});
