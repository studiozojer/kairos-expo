/**
 * PlanetLayoutEngine tests — translated VERBATIM from
 * kairos-swiftTests/Features/ChartWheel/Layout/PlanetLayoutEngineNudgeTests.swift
 * (305 lines, 7 cases; PR #151 follow-up #3 — Stage 3.7 Task 24).
 *
 * Tests that PlanetLayoutEngine respects the nudgeDistance value from
 * OverlapPreventionConfigV3, i.e. distinct nudge values produce distinct layouts.
 *
 * Translation notes (Task 6):
 *  - Swift's engine returns CGPoint positions at radius 140 around center
 *    (200, 200); the TS engine returns { id, trueLongitude, adjustedLongitude }.
 *    Tests convert longitudes back to points via ChartCoordinateSystem
 *    (orientation 0 → canvasAngle = 180 − longitude) at radius 140, so every
 *    distance/angle assertion is computed in the same screen space as Swift.
 *  - All thresholds (1.0pt, 0.1pt, 0.01pt, 0.001rad, 3.0pt, 0.5pt) are the
 *    Swift hand-computed values, verbatim. `#expect(x)` → `expect(x).toBe(true)`.
 */

import { PlanetLayoutEngine } from "../PlanetLayoutEngine";
import { ChartCoordinateSystem } from "../ChartCoordinateSystem";
import type { Point } from "../types";

// MARK: - Helpers

/** Minimal placement shape consumed by the TS engine. */
interface TestPlacement {
  id: string;
  longitude: number;
}

/** Swift: ChartCoordinateSystem centred on a 400×400 canvas, orientation 0. */
const coordinates = new ChartCoordinateSystem({ x: 200, y: 200 }, 0);

/**
 * Swift RingGeometry(canvasSize: 400×400, centerPoint: (200,200),
 * outerRadius: 180, ringThicknesses: [40], ringGap: 2) — only the center
 * survives into the TS coordinate system; the engine itself is fed
 * radius=140, outerRadius=160, innerRadius=120, ringThickness=40 as in Swift.
 */
const ENGINE_RADIUS = 140;

/** Convert a zodiac longitude to the same CGPoint the Swift engine produces. */
function pointForLongitude(longitude: number): Point {
  return coordinates.pointForDegree(longitude, ENGINE_RADIUS);
}

/**
 * Swift makeStyle(): PlanetsRingStyle.default with useGlyphs=false,
 * circleRadius=8. bbox = circleRadius*2 + 2 padding = 18pt.
 */
const USE_GLYPHS = false;
const GLYPH_SIZE = 18; // PlanetsRingStyle.default; unused while useGlyphs=false
const CIRCLE_RADIUS = 8;

/** Swift runEngineFullLayout — full layout array for arbitrary placements. */
function runEngineFullLayout(
  longitudes: number[],
  nudgeDistance: number,
  circleRadius: number = CIRCLE_RADIUS,
): { id: string; trueLongitude: number; adjustedLongitude: number }[] {
  const placements: TestPlacement[] = longitudes.map((longitude, idx) => ({
    id: `p${idx}`,
    longitude,
  }));
  return PlanetLayoutEngine.calculateNonOverlappingLayout(placements, {
    radius: ENGINE_RADIUS,
    nudgeDistance,
    useGlyphs: USE_GLYPHS,
    glyphSize: GLYPH_SIZE,
    circleRadius,
  });
}

/**
 * Swift runEngine — two overlapping placements (sun 90.0°, moon 90.5°);
 * returns the adjusted position of the first planet.
 */
function runEngine(nudgeDistance: number): Point {
  const layout = PlanetLayoutEngine.calculateNonOverlappingLayout(
    [
      { id: "sun", longitude: 90.0 },
      { id: "moon", longitude: 90.5 }, // very close — guaranteed overlap
    ],
    {
      radius: ENGINE_RADIUS,
      nudgeDistance,
      useGlyphs: USE_GLYPHS,
      glyphSize: GLYPH_SIZE,
      circleRadius: CIRCLE_RADIUS,
    },
  );
  // Return the adjusted position of the first planet.
  return pointForLongitude(layout[0].adjustedLongitude);
}

function distance(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// MARK: - Tests

/// Different nudgeDistance values must produce different adjusted positions.
///
/// With nudgeDistance = 0 the engine spreads planets to the touching baseline
/// (separation = bboxSize). With nudgeDistance = 30 the required separation is
/// bboxSize + 30, substantially larger, so the spread angle is wider and the
/// adjusted positions differ.
test("differentNudgeDistancesProduceDifferentLayouts", () => {
  const posLow = runEngine(0.0);
  const posHigh = runEngine(30.0);

  const dist = distance(posLow, posHigh);

  // The two spread results must be meaningfully different in screen space.
  expect(dist > 1.0).toBe(true);
});

/// Zero nudgeDistance must still separate overlapping planets.
///
/// At nudgeDistance = 0 the engine still spreads to the touching baseline
/// (separation = bboxSize) — the adjusted position must differ from the exact
/// 90° longitude.
test("zeroNudgeStillSeparatesOverlappingPlanets", () => {
  const layout = PlanetLayoutEngine.calculateNonOverlappingLayout(
    [
      { id: "sun", longitude: 90.0 },
      { id: "moon", longitude: 90.5 },
    ],
    {
      radius: ENGINE_RADIUS,
      nudgeDistance: 0.0,
      useGlyphs: USE_GLYPHS,
      glyphSize: GLYPH_SIZE,
      circleRadius: CIRCLE_RADIUS,
    },
  );

  const originalPos = pointForLongitude(layout[0].trueLongitude);
  const adjustedPos = pointForLongitude(layout[0].adjustedLongitude);

  const moved = distance(originalPos, adjustedPos);

  expect(moved > 0.1).toBe(true);
});

/// A planet whose neighbors are far enough away should not be moved at all.
/// Guards against the Lot-of-Spirit regression where over-clustering pulled
/// non-overlapping planets toward cluster centers.
test("singletonStaysExactlyAtTrueLongitude", () => {
  // Three planets, well separated: 30°, 90°, 270°.
  // None of them should be in a block; all should stay at their true longitude.
  const layout = runEngineFullLayout([30.0, 90.0, 270.0], 0.0);
  for (const position of layout) {
    const moved = distance(
      pointForLongitude(position.trueLongitude),
      pointForLongitude(position.adjustedLongitude),
    );
    expect(moved < 0.01).toBe(true); // "Singleton planet should not move"
  }
});

/// Two overlapping planets should form a 2-member block centered at their
/// true-longitude midpoint. Each should move by the same amount from its
/// true position (symmetric spread). Guards against the circular-mean
/// drift that pulled planets toward each other rather than apart.
test("twoMemberBlockSpreadsSymmetricallyAroundTrueMean", () => {
  // Two planets exactly 0.5° apart at 90.0° and 90.5°. They'll overlap;
  // they should be placed symmetrically around their true midpoint 90.25°.
  const layout = runEngineFullLayout([90.0, 90.5], 0.0);

  // Compute angular displacements from true longitudes.
  // Swift: atan2 of adjusted/original positions around chart center (200, 200).
  const angle0 = Math.atan2(
    pointForLongitude(layout[0].adjustedLongitude).y - 200,
    pointForLongitude(layout[0].adjustedLongitude).x - 200,
  );
  const angle1 = Math.atan2(
    pointForLongitude(layout[1].adjustedLongitude).y - 200,
    pointForLongitude(layout[1].adjustedLongitude).x - 200,
  );

  // Original angles (true longitudes converted via coordinates).
  const orig0 = Math.atan2(
    pointForLongitude(layout[0].trueLongitude).y - 200,
    pointForLongitude(layout[0].trueLongitude).x - 200,
  );
  const orig1 = Math.atan2(
    pointForLongitude(layout[1].trueLongitude).y - 200,
    pointForLongitude(layout[1].trueLongitude).x - 200,
  );

  const move0 = Math.abs(angle0 - orig0);
  const move1 = Math.abs(angle1 - orig1);

  // Symmetric spread means each planet moves by approximately the same magnitude.
  expect(Math.abs(move0 - move1) < 0.001).toBe(true); // "Two-member block should spread symmetrically"

  // Both should have moved (non-zero displacement).
  expect(move0 > 0.001).toBe(true); // "Planet 0 should have moved"
  expect(move1 > 0.001).toBe(true); // "Planet 1 should have moved"
});

/// When a later planet joins a block, the block's leftward expansion may
/// pull in a previously-untouched planet via the backward-cascade merge.
/// Verifies PAV (Pool Adjacent Violators) propagation works correctly.
test("backwardCascadePullsInPreviouslyUntouchedPlanet", () => {
  // Planet A at 80°, plus a tight cluster at 90°, 91°, 92°.
  // At nudge=0, required separation is bboxSize=circleRadius*2+padding=18pt
  // which is roughly 7.4° on r=140 ring. A is 10° from the cluster's first
  // member (90°), so doesn't overlap with it. But the cluster expands
  // backward; the new first member sits below 90°, which may cross into A.
  const circleRadius = 8.0; // bbox ~18pt → ~7.4° angular at r=140
  const layout = runEngineFullLayout([80.0, 90.0, 91.0, 92.0], 0.0, circleRadius);

  // Check minimum pairwise separation across all adjacent pairs.
  // Convert to angular positions.
  const angles = layout.map((p) => {
    const pos = pointForLongitude(p.adjustedLongitude);
    return Math.atan2(pos.y - 200, pos.x - 200);
  });
  const sortedAngles = [...angles].sort((a, b) => a - b);
  let minGapRadians = Infinity;
  for (let k = 0; k < sortedAngles.length - 1; k++) {
    const gap = sortedAngles[k + 1] - sortedAngles[k];
    minGapRadians = Math.min(minGapRadians, gap);
  }
  const minGapDegrees = (minGapRadians * 180.0) / Math.PI;

  // Required separation in degrees: 2*asin((bboxSize/2)/radius) * (180/pi)
  const bboxSize = circleRadius * 2 + 2; // +2 padding from calculateBoundingBox
  const requiredSepDegrees = 2.0 * Math.asin(bboxSize / 2 / 140.0) * (180.0 / Math.PI);

  // All pairs must satisfy the separation constraint, including the A-B pair
  // which would be violated if backward cascade weren't implemented.
  expect(minGapDegrees >= requiredSepDegrees - 0.01).toBe(true);
  // "All pairs must respect minimum separation"
});

/// A small change in nudgeDistance should produce a proportionally small
/// change in adjusted positions. Guards against the Sun/Uranus discontinuity
/// where a 1pt nudge bump produced dramatic glyph repositioning via cluster
/// topology changes.
test("smallNudgeChangeProducesSmallLayoutChange", () => {
  // A modest cluster at 88°, 90°, 92°, 94°.
  const longitudes = [88.0, 90.0, 92.0, 94.0];

  const layoutA = runEngineFullLayout(longitudes, 4.0);
  const layoutB = runEngineFullLayout(longitudes, 4.5);

  // Maximum per-planet displacement from layoutA to layoutB.
  let maxShiftPoints = 0.0;
  for (let k = 0; k < longitudes.length; k++) {
    const shift = distance(
      pointForLongitude(layoutA[k].adjustedLongitude),
      pointForLongitude(layoutB[k].adjustedLongitude),
    );
    maxShiftPoints = Math.max(maxShiftPoints, shift);
  }

  // A 0.5pt nudge change should produce at most ~1pt displacement per planet
  // (the block boundary may shift by half the change in each direction).
  // Generous upper bound of 3pt to catch dramatic regressions while allowing
  // for some legitimate spread propagation.
  expect(maxShiftPoints < 3.0).toBe(true);
  // "Small nudge change (0.5pt) caused large displacement"
});

/// A block spanning the 0°/360° seam (e.g., Pisces 28° to Aries 2°) must
/// be placed correctly without sort-order corruption.
test("wraparoundBlockHandledCorrectly", () => {
  // Planets at 358° and 2° — only 4° apart angularly, will need spreading.
  const layout = runEngineFullLayout([358.0, 2.0], 0.0);

  // Both planets should have moved (they form a 2-member block across the seam).
  // The block's midpoint is 0° (or 360°), so 358 should move slightly negative
  // and 2 should move slightly positive.
  const moved0 = distance(
    pointForLongitude(layout[0].trueLongitude),
    pointForLongitude(layout[0].adjustedLongitude),
  );
  const moved1 = distance(
    pointForLongitude(layout[1].trueLongitude),
    pointForLongitude(layout[1].adjustedLongitude),
  );

  expect(moved0 > 0.5).toBe(true); // "Planet at 358° should have moved"
  expect(moved1 > 0.5).toBe(true); // "Planet at 2° should have moved"

  // Symmetric: each moved by approximately the same amount.
  expect(Math.abs(moved0 - moved1) < 0.5).toBe(true); // "Wraparound block should spread symmetrically"
});
