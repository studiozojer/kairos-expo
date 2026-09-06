/**
 * Coordinate-convention anchors for ChartCoordinateSystem.
 *
 * There are NO Swift unit tests pinning these values (verified 2026-08-14:
 * kairos-swiftTests only *constructs* a ChartCoordinateSystem in the two
 * Layout suites, never asserts on zodiacToCanvasAngle/pointForDegree/
 * calculateMidpoint). Expected values below are hand-derived from the Swift
 * formula `canvasAngle = 180 − (zodiac − orientation)` (ChartGeometry.swift
 * :117-121) and the wraparound midpoint algorithm (:161-173). Canvas is
 * y-down — SwiftUI and Skia agree — so canvas 90° is 6 o'clock.
 */

import { ChartCoordinateSystem } from "../ChartCoordinateSystem";

// ---------------------------------------------------------------------------
// Anchor tests mandated by the plan (Task 5 step 2), verbatim
// ---------------------------------------------------------------------------

test("0° Aries sits at 9 o'clock when ASC is 0° Aries", () => {
  const cs = new ChartCoordinateSystem({ x: 0, y: 0 }, 0);
  expect(cs.zodiacToCanvasAngle(0)).toBe(180); // canvas 180° = 9 o'clock
});

test("zodiac runs counterclockwise on a clockwise canvas", () => {
  const cs = new ChartCoordinateSystem({ x: 0, y: 0 }, 0);
  expect(cs.zodiacToCanvasAngle(90)).toBe(90); // 0° Cancer at 6 o'clock (canvas y-down)
});

test("midpoint wraps across 0° Aries", () => {
  const cs = new ChartCoordinateSystem({ x: 0, y: 0 }, 0);
  expect(cs.calculateMidpoint(350, 10)).toBe(0);
});

// ---------------------------------------------------------------------------
// Derived anchors (hand-computed from the same formulas)
// ---------------------------------------------------------------------------

test("orientation rotates the wheel: ASC 0° Cancer sits at 9 o'clock", () => {
  // canvasAngle = 180 − (90 − 90) = 180
  const cs = new ChartCoordinateSystem({ x: 0, y: 0 }, 90);
  expect(cs.zodiacToCanvasAngle(90)).toBe(180);
});

test("orientation shifts every degree by the same amount", () => {
  // canvasAngle = 180 − (0 − 90) = 270 → 12 o'clock (y-down canvas: up)
  const cs = new ChartCoordinateSystem({ x: 0, y: 0 }, 90);
  expect(cs.zodiacToCanvasAngle(0)).toBe(270);
});

test("pointForDegree places 0° Aries at 9 o'clock on the given radius", () => {
  // angle 180° → x = 0 + 100·cos(π) = −100, y = 0 + 100·sin(π) ≈ 0
  const cs = new ChartCoordinateSystem({ x: 0, y: 0 }, 0);
  const p = cs.pointForDegree(0, 100);
  expect(p.x).toBeCloseTo(-100);
  expect(p.y).toBeCloseTo(0);
});

test("pointForDegree is center-relative and y-down (0° Cancer below center)", () => {
  // canvas 90°, center (200, 200), r 50 → x = 200 + 50·cos(π/2) ≈ 200,
  // y = 200 + 50·sin(π/2) = 250 — y grows downward, so 250 is 6 o'clock.
  const cs = new ChartCoordinateSystem({ x: 200, y: 200 }, 0);
  const p = cs.pointForDegree(90, 50);
  expect(p.x).toBeCloseTo(200);
  expect(p.y).toBeCloseTo(250);
});

test("midpoint without wraparound is the simple average", () => {
  // Swift doc example: 10° to 20° → 15°
  const cs = new ChartCoordinateSystem({ x: 0, y: 0 }, 0);
  expect(cs.calculateMidpoint(10, 20)).toBe(15);
});

test("midpoint is directional: the reversed pair does NOT wrap", () => {
  // The wrap branch only fires when end < start, so (10, 350) averages the
  // long way: (10 + 350) / 2 = 180 — not 0. Pins the Swift asymmetry.
  const cs = new ChartCoordinateSystem({ x: 0, y: 0 }, 0);
  expect(cs.calculateMidpoint(10, 350)).toBe(180);
});
