/**
 * Translated, case-for-case and value-for-value, from
 * kairos-swiftTests/Features/ChartWheel/RingGeometryBuilderTests.swift
 * (454 lines, 19 @Test cases). Hand-computed expected values kept EXACTLY;
 * `#expect(a == b)` → `toBe`, `#expect(a < b)` → `toBeLessThan`.
 *
 * Swift's test fixtures build full RingConfiguration values (type + style +
 * thickness); the calculation reads ONLY `thickness`, so the translated
 * fixtures carry just that. `ringModules` is a legacy no-longer-used
 * parameter in Swift (RingGeometryBuilder.swift:28) — call sites keep the
 * empty-array argument for signature parity.
 */

import {
  OVERLAP_PREVENTION_DEFAULT,
  type GlobalChartVariables,
  type RingThickness,
} from "../../schema/core-types";
import type { RingModule } from "../../schema/ring-module";
import { RingGeometryBuilder } from "../RingGeometryBuilder";

// ---------------------------------------------------------------------------
// Test helpers (mirror the Swift file's private static helpers)
// ---------------------------------------------------------------------------

/** The calculation only reads `thickness`; Swift's type/style payload is omitted. */
type TestRingConfiguration = { thickness: RingThickness };

const fixed = (value: number): RingThickness => ({ kind: "fixed", value });

/** Swift: RingConfiguration(type: .zodiacSigns, style: .zodiac(.default), thickness:) */
function zodiacRingConfig(thickness: RingThickness = { kind: "auto" }): TestRingConfiguration {
  return { thickness };
}

/**
 * Swift: RingConfiguration(type: .planets(placements: [], ringNumber:,
 * maxRingNumber:, drawInnerBoundary: false), style: .planets(.default),
 * thickness:). ringNumber/maxRingNumber are RingContentType payload and do
 * not feed the thickness math; the parameters are kept so call sites read
 * like the Swift originals.
 */
function planetsRingConfig(
  _ringNumber = 1,
  _maxRingNumber = 1,
  thickness: RingThickness = { kind: "auto" },
): TestRingConfiguration {
  return { thickness };
}

/** Swift: RingConfiguration(type: .houseNumbers, style: .houseNumbers(.default), thickness:) */
function housesRingConfig(thickness: RingThickness = { kind: "auto" }): TestRingConfiguration {
  return { thickness };
}

/** Swift: GlobalChartVariables(margin:, minimumInnerRadius:, ringGap:, ...) with the same defaults. */
function testGlobalStyle(
  margin = 10,
  minimumInnerRadius = 50,
  ringGap = 2,
): GlobalChartVariables {
  return {
    margin,
    minimumInnerRadius,
    ringGap,
    variableRingSizing: "equalDistribution",
    defaultHitRadius: 20,
    moduleHitRadiusOverrides: {},
    staticOrientationDegree: 0,
    overlapPrevention: OVERLAP_PREVENTION_DEFAULT,
  };
}

// ---------------------------------------------------------------------------
// MARK: - Basic Calculation Tests
// ---------------------------------------------------------------------------

test("returnsEmptyArrayForEmptyRings", () => {
  const thicknesses = RingGeometryBuilder.calculateRingThicknesses(
    400,
    [],
    [],
    testGlobalStyle(),
  );

  expect(thicknesses).toEqual([]);
});

test("returnsCorrectCountOfThicknesses", () => {
  const rings = [zodiacRingConfig(), planetsRingConfig(), housesRingConfig()];
  const modules: RingModule[] = [];

  const thicknesses = RingGeometryBuilder.calculateRingThicknesses(
    400,
    rings,
    modules,
    testGlobalStyle(),
  );

  expect(thicknesses.length).toBe(3);
});

// ---------------------------------------------------------------------------
// MARK: - Fixed Thickness Tests
// ---------------------------------------------------------------------------

test("respectsFixedThicknessForZodiac", () => {
  const rings = [zodiacRingConfig(fixed(30))];
  const modules: RingModule[] = []; // No longer used

  const thicknesses = RingGeometryBuilder.calculateRingThicknesses(
    400,
    rings,
    modules,
    testGlobalStyle(),
  );

  expect(thicknesses[0]).toBe(30);
});

test("respectsFixedThicknessForHouses", () => {
  const rings = [housesRingConfig(fixed(25))];
  const modules: RingModule[] = []; // No longer used

  const thicknesses = RingGeometryBuilder.calculateRingThicknesses(
    400,
    rings,
    modules,
    testGlobalStyle(),
  );

  expect(thicknesses[0]).toBe(25);
});

test("respectsFixedThicknessForPlanets", () => {
  const rings = [planetsRingConfig(1, 1, fixed(40))];
  const modules: RingModule[] = []; // No longer used

  const thicknesses = RingGeometryBuilder.calculateRingThicknesses(
    400,
    rings,
    modules,
    testGlobalStyle(),
  );

  expect(thicknesses[0]).toBe(40);
});

// ---------------------------------------------------------------------------
// MARK: - Auto Thickness Tests
// ---------------------------------------------------------------------------

test("calculatesAutoThicknessForSingleRing", () => {
  // Chart size: 400, margin: 10, inner radius: 50, gap: 0
  // Available radius = 400/2 - 10 = 190
  // Available space = 190 - 50 - 0 = 140
  // With 1 auto ring, thickness = 140
  const rings = [zodiacRingConfig({ kind: "auto" })];
  const modules: RingModule[] = []; // No longer used

  const thicknesses = RingGeometryBuilder.calculateRingThicknesses(
    400,
    rings,
    modules,
    testGlobalStyle(),
  );

  expect(thicknesses[0]).toBe(140);
});

test("distributesAutoThicknessEqually", () => {
  // 3 auto rings, each gets 1/3 of available space
  // Available = 190 - 50 - 4 (2 gaps * 2) = 136
  // Each ring = 136 / 3 ≈ 45.33
  const rings = [
    zodiacRingConfig({ kind: "auto" }),
    planetsRingConfig(1, 1, { kind: "auto" }),
    housesRingConfig({ kind: "auto" }),
  ];
  const modules: RingModule[] = []; // No longer used

  const thicknesses = RingGeometryBuilder.calculateRingThicknesses(
    400,
    rings,
    modules,
    testGlobalStyle(),
  );

  // All three should be equal
  expect(thicknesses[0]).toBe(thicknesses[1]);
  expect(thicknesses[1]).toBe(thicknesses[2]);
});

// ---------------------------------------------------------------------------
// MARK: - Mixed Fixed and Auto Tests
// ---------------------------------------------------------------------------

test("mixedFixedAndAutoDistributesCorrectly", () => {
  // Zodiac fixed at 30, planets auto, houses fixed at 20
  // Available = 190 - 50 - 4 = 136
  // Fixed space = 30 + 20 = 50
  // Auto space = 136 - 50 = 86
  const rings = [
    zodiacRingConfig(fixed(30)),
    planetsRingConfig(1, 1, { kind: "auto" }),
    housesRingConfig(fixed(20)),
  ];
  const modules: RingModule[] = []; // No longer used

  const thicknesses = RingGeometryBuilder.calculateRingThicknesses(
    400,
    rings,
    modules,
    testGlobalStyle(),
  );

  expect(thicknesses[0]).toBe(30); // Zodiac fixed
  expect(thicknesses[1]).toBe(86); // Planets auto gets remaining space
  expect(thicknesses[2]).toBe(20); // Houses fixed
});

// ---------------------------------------------------------------------------
// MARK: - Planet Ring Expansion Tests
// ---------------------------------------------------------------------------

test("expandsPlanetRingForMultipleCharts", () => {
  // Multiple planet rings with independent thicknesses
  const rings = [
    zodiacRingConfig(fixed(30)),
    planetsRingConfig(2, 2, fixed(40)), // Outer planets
    planetsRingConfig(1, 2, fixed(40)), // Inner planets
    housesRingConfig(fixed(20)),
  ];
  const modules: RingModule[] = []; // No longer used

  const thicknesses = RingGeometryBuilder.calculateRingThicknesses(
    400,
    rings,
    modules,
    testGlobalStyle(),
  );

  expect(thicknesses[0]).toBe(30); // Zodiac
  expect(thicknesses[1]).toBe(40); // Planets ring 2
  expect(thicknesses[2]).toBe(40); // Planets ring 1
  expect(thicknesses[3]).toBe(20); // Houses
});

test("autoPlanetRingsShareSpaceEqually", () => {
  // 2 auto planet rings should share available space
  const rings = [
    zodiacRingConfig(fixed(30)),
    planetsRingConfig(2, 2, { kind: "auto" }),
    planetsRingConfig(1, 2, { kind: "auto" }),
    housesRingConfig(fixed(20)),
  ];
  const modules: RingModule[] = []; // No longer used
  // Available = 190 - 50 - 6 = 134 (3 gaps)
  // Fixed = 30 + 20 = 50
  // Auto space = 134 - 50 = 84
  // 2 auto planet rings each get 84/2 = 42

  const thicknesses = RingGeometryBuilder.calculateRingThicknesses(
    400,
    rings,
    modules,
    testGlobalStyle(),
  );

  expect(thicknesses[1]).toBe(thicknesses[2]); // Both planet rings equal
});

// ---------------------------------------------------------------------------
// MARK: - Disabled Module Tests (now tests minimum thickness)
// ---------------------------------------------------------------------------

test("clampsToMinimumThickness", () => {
  // Test that very small or negative auto thickness is clamped to minimum
  const rings = [zodiacRingConfig(fixed(30)), housesRingConfig(fixed(20))];
  const modules: RingModule[] = [];

  const thicknesses = RingGeometryBuilder.calculateRingThicknesses(
    400,
    rings,
    modules,
    testGlobalStyle(),
  );

  // Both fixed, should respect values
  expect(thicknesses.length).toBe(2);
  expect(thicknesses[0]).toBe(30);
  expect(thicknesses[1]).toBe(20);
});

// ---------------------------------------------------------------------------
// MARK: - Global Style Impact Tests
// ---------------------------------------------------------------------------

test("marginReducesAvailableSpace", () => {
  const rings = [zodiacRingConfig({ kind: "auto" })];
  const modules: RingModule[] = [];

  const thicknessSmallMargin = RingGeometryBuilder.calculateRingThicknesses(
    400,
    rings,
    modules,
    testGlobalStyle(10),
  );

  const thicknessLargeMargin = RingGeometryBuilder.calculateRingThicknesses(
    400,
    rings,
    modules,
    testGlobalStyle(30),
  );

  expect(thicknessLargeMargin[0]).toBeLessThan(thicknessSmallMargin[0]);
});

test("innerRadiusReducesAvailableSpace", () => {
  const rings = [zodiacRingConfig({ kind: "auto" })];
  const modules: RingModule[] = [];

  const thicknessSmallInner = RingGeometryBuilder.calculateRingThicknesses(
    400,
    rings,
    modules,
    testGlobalStyle(10, 30),
  );

  const thicknessLargeInner = RingGeometryBuilder.calculateRingThicknesses(
    400,
    rings,
    modules,
    testGlobalStyle(10, 80),
  );

  expect(thicknessLargeInner[0]).toBeLessThan(thicknessSmallInner[0]);
});

test("ringGapReducesAvailableSpace", () => {
  const rings = [zodiacRingConfig({ kind: "auto" }), housesRingConfig({ kind: "auto" })];
  const modules: RingModule[] = [];

  const thicknessNoGap = RingGeometryBuilder.calculateRingThicknesses(
    400,
    rings,
    modules,
    testGlobalStyle(10, 50, 0),
  );

  const thicknessWithGap = RingGeometryBuilder.calculateRingThicknesses(
    400,
    rings,
    modules,
    testGlobalStyle(10, 50, 10),
  );

  // With gaps, each ring gets less space
  expect(thicknessWithGap[0]).toBeLessThan(thicknessNoGap[0]);
});

// ---------------------------------------------------------------------------
// MARK: - Edge Cases
// ---------------------------------------------------------------------------

test("handlesAllFixedRings", () => {
  const rings = [zodiacRingConfig(fixed(50)), housesRingConfig(fixed(30))];
  const modules: RingModule[] = [];

  const thicknesses = RingGeometryBuilder.calculateRingThicknesses(
    400,
    rings,
    modules,
    testGlobalStyle(),
  );

  expect(thicknesses[0]).toBe(50);
  expect(thicknesses[1]).toBe(30);
});

test("emptyRingUsesItsOwnThickness", () => {
  // Empty ring with auto thickness. Swift builds
  // RingConfiguration(type: .empty, style: .empty(EmptyRingStyle(
  //   boundaryLineWidth: 1, showBoundaries: false,
  //   backgroundColor: nil, boundaryLineColor: nil)), thickness: .auto)
  // — the TS schema has no empty-ring style variant and the calculation
  // never reads style, so only the thickness survives translation.
  const rings: TestRingConfiguration[] = [{ thickness: { kind: "auto" } }];
  const modules: RingModule[] = [];

  const thicknesses = RingGeometryBuilder.calculateRingThicknesses(
    400,
    rings,
    modules,
    testGlobalStyle(),
  );

  // Should use full available space as it's the only auto ring
  expect(thicknesses.length).toBe(1);
  expect(thicknesses[0]).toBe(140); // 400/2 - 10 - 50 = 140
});

test("handlesLargeChartSize", () => {
  const rings = [zodiacRingConfig({ kind: "auto" })];
  const modules: RingModule[] = [];

  const thicknesses = RingGeometryBuilder.calculateRingThicknesses(
    2000,
    rings,
    modules,
    testGlobalStyle(),
  );

  // Available = 2000/2 - 10 - 50 = 940
  expect(thicknesses[0]).toBe(940);
});

test("handlesSmallChartSize", () => {
  const rings = [zodiacRingConfig({ kind: "auto" })];
  const modules: RingModule[] = [];

  const thicknesses = RingGeometryBuilder.calculateRingThicknesses(
    100,
    rings,
    modules,
    testGlobalStyle(5, 10, 0),
  );

  // Available = 100/2 - 5 - 10 = 35
  expect(thicknesses[0]).toBe(35);
});

// ---------------------------------------------------------------------------
// MARK: - Minimum Thickness Clamping Tests
// ---------------------------------------------------------------------------

test("clampsNegativeAutoThicknessToMinimum", () => {
  // Fixed rings consume more than available space
  // This should clamp auto thickness to minimum (5pt)
  const rings = [
    zodiacRingConfig(fixed(100)),
    planetsRingConfig(1, 1, { kind: "auto" }), // Would be negative without clamping
    housesRingConfig(fixed(100)),
  ];
  const modules: RingModule[] = [];
  // Available = 190 - 50 - 4 = 136
  // Fixed = 200, leaving -64 for auto rings
  // Clamped to minimum = 5

  const thicknesses = RingGeometryBuilder.calculateRingThicknesses(
    400,
    rings,
    modules,
    testGlobalStyle(),
  );

  expect(thicknesses[0]).toBe(100); // Fixed
  expect(thicknesses[1]).toBe(5); // Clamped to minimum
  expect(thicknesses[2]).toBe(100); // Fixed
});
