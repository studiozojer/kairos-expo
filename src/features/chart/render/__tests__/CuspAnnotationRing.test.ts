/**
 * CuspAnnotationRing unit tests (Task 10) — `isInUpperRegion` boundary +
 * wraparound cases (Swift `CuspAnnotationRing.swift:246-250`: upper region
 * is canvas angles [190°, 360°) ∪ [0°, 10°)).
 */

import { isInUpperRegion } from "../rings/CuspAnnotationRing";

test("isInUpperRegion: boundary at 190° and just below it", () => {
  expect(isInUpperRegion(190)).toBe(true);
  expect(isInUpperRegion(189.999)).toBe(false);
});

test("isInUpperRegion: boundary at 10° and just above it", () => {
  expect(isInUpperRegion(9.999)).toBe(true);
  expect(isInUpperRegion(10)).toBe(false);
});

test("isInUpperRegion: negative angles normalize (wraparound)", () => {
  // -5° ≡ 355°, inside the upper region.
  expect(isInUpperRegion(-5)).toBe(true);
  // -170° ≡ 190°, the boundary itself.
  expect(isInUpperRegion(-170)).toBe(true);
});

test("isInUpperRegion: mid-lower-region angle (e.g. 90°) is not upper", () => {
  expect(isInUpperRegion(90)).toBe(false);
});

test("isInUpperRegion: angles beyond 360° normalize the same way", () => {
  expect(isInUpperRegion(370)).toBe(false); // 370 % 360 = 10 -> NOT upper (>=10 boundary)
  expect(isInUpperRegion(369)).toBe(true); // 369 % 360 = 9 -> upper
});
