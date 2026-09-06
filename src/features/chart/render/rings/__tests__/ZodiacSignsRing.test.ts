/**
 * ZodiacSignsRing.segmentPath geometry test (final-review fix wave, finding
 * 1). `PathBuilder.addArc` binds `SkPathBuilder::arcTo(oval, start, sweep,
 * forceMoveTo: TRUE)` — it always opens a NEW contour, unlike Swift's
 * `Path.addArc` which continues the current subpath. `segmentPath` used
 * `addArc` for both the outer and inner arcs, so each segment fill built as
 * TWO contours (outer arc + radial line, chord-closed; inner arc,
 * chord-closed) instead of Swift's single continuous subpath (outer arc ->
 * line to inner -> inner arc reversed -> close) — the tapered-leaf-with-
 * notches fill artifact seen on device.
 *
 * This runs through the real-CanvasKit jest environment (jest.skia-env.js —
 * see AGENTS.md § jest), so `path.toSVGString()` reflects actual Skia path
 * math, not a mock.
 */

import { segmentPath } from "../ZodiacSignsRing";

test("segmentPath builds a single continuous contour (one M in the SVG path)", () => {
  const path = segmentPath(0, 0, 100, 60, 0, -30);
  const svg = path.toSVGString();
  const moveCount = (svg.match(/M/gi) ?? []).length;
  expect(moveCount).toBe(1);
});

test("segmentPath's single contour is closed", () => {
  const path = segmentPath(0, 0, 100, 60, 0, -30);
  const svg = path.toSVGString();
  expect(svg.trim().toUpperCase().endsWith("Z")).toBe(true);
});
