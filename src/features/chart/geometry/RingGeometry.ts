/**
 * RingGeometry — radial layout for the concentric rings of a chart wheel.
 *
 * Mirrors kairos-ios `.../Viewing/Wheel/Core/ChartGeometry.swift` (:3-73).
 *
 * Rings are stacked outside-in, indexed from the OUTERMOST ring (index 0)
 * inward. Each inner ring's outer edge is offset by the cumulative
 * thickness + gap of all rings outside it:
 *
 * ```
 * Outermost (index 0): outerRadius → outerRadius − thickness
 * Ring 1:              outerRadius − (thickness + gap) → …
 * Ring 2:              outerRadius − 2·(thickness + gap) → …
 * ```
 *
 * Differences from the Swift struct (per the Task 5 plan interface):
 *  - Swift also stores `canvasSize` and `centerPoint`; both are unused by
 *    the radius math, and the TS `ChartCoordinateSystem` owns the center —
 *    so this port drops them.
 *  - The plan's stated constructor is `(outerRadius, thicknesses)`; this
 *    port adds an OPTIONAL third parameter `ringGap` (default 0) because
 *    Swift's `radiusForRing` accumulates `ringGap` per ring and presets can
 *    set a non-zero gap (e.g. SystemPresets.swift:496 `ringGap: 1.0`).
 *    Callers building a layout MUST pass the (scaled) global `ringGap` or
 *    ring radii drift inward by `index × ringGap`.
 *
 * Out-of-range indices return `outerRadius` (Swift's guard behavior).
 */
export class RingGeometry {
  /** Radius of the outermost ring edge. */
  readonly outerRadius: number;

  /** Thickness of each ring (can vary per ring), outermost-first. */
  readonly ringThicknesses: readonly number[];

  /** Gap between adjacent rings. */
  readonly ringGap: number;

  constructor(outerRadius: number, thicknesses: readonly number[], ringGap = 0) {
    this.outerRadius = outerRadius;
    this.ringThicknesses = thicknesses;
    this.ringGap = ringGap;
  }

  /**
   * Outer radius for a specific ring (0 = outermost). Rings move inward by
   * the cumulative thickness of all previous rings plus gaps.
   */
  radiusForRing(index: number): number {
    if (index < 0 || index >= this.ringThicknesses.length) {
      return this.outerRadius;
    }

    // Cumulative offset from all previous rings
    let offset = 0;
    for (let i = 0; i < index; i++) {
      offset += this.ringThicknesses[i] + this.ringGap;
    }

    return this.outerRadius - offset;
  }

  /** Inner radius for a specific ring (0 = outermost). */
  innerRadiusForRing(index: number): number {
    if (index < 0 || index >= this.ringThicknesses.length) {
      return this.outerRadius;
    }
    return this.radiusForRing(index) - this.ringThicknesses[index];
  }

  /**
   * Middle radius for a specific ring — used for placing elements centered
   * within a ring's width.
   */
  midRadiusForRing(index: number): number {
    return (this.radiusForRing(index) + this.innerRadiusForRing(index)) / 2;
  }
}
