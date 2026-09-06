/**
 * ChartCoordinateSystem — coordinate transformation for chart rendering.
 *
 * Mirrors kairos-ios `.../Viewing/Wheel/Core/ChartGeometry.swift` (:75-174).
 * The conversion is non-trivial because the two systems disagree:
 *
 * **Astrological convention:**
 * - 0° Aries is at the 9 o'clock position (left)
 * - Degrees increase counter-clockwise
 * - Charts rotate to place the Ascendant at 9 o'clock
 *
 * **Canvas convention (SwiftUI and Skia agree: y-down):**
 * - 0° is at the 3 o'clock position (right)
 * - Degrees increase clockwise (y grows downward)
 *
 * Differences from the Swift struct (per the Task 5 plan interface):
 *  - Holds `center` + `orientation` only; Swift also holds a `RingGeometry`
 *    and derives the radius from a ring index. Here `pointForDegree` takes
 *    an explicit radius, so the coordinate system is decoupled from ring
 *    layout (RingGeometry stays the single source of radii).
 *  - `zodiacToCanvasAngle` returns plain degrees (Swift wraps them in
 *    `SwiftUI.Angle`).
 *
 * MIDPOINT BOUNDARY NOTE (deviation from Swift code, per spec):
 * Swift's `calculateMidpoint` guards with `if mid > 360`, which returns
 * **360** for (350, 10) — contradicting its own doc example (:150, "350°
 * to 10° → 0°") and the plan's mandated anchor test. The boundary is
 * render-neutral downstream (HouseNumbersRing.swift:78 feeds the result
 * into trig, where 360° ≡ 0°), and no Swift test pins either value. This
 * port normalizes with `>=`, following Swift's documented contract.
 */

import type { Point } from "./types";

export class ChartCoordinateSystem {
  /** Center point of all concentric rings, in canvas coordinates. */
  readonly center: Point;

  /**
   * Chart rotation in degrees (typically the Ascendant's position).
   * Applied to position the Ascendant at the 9 o'clock position.
   */
  readonly orientation: number;

  constructor(center: Point, orientation: number) {
    this.center = center;
    this.orientation = orientation;
  }

  /**
   * Convert zodiac longitude (0-360°) to canvas angle (degrees).
   *
   * - Step 1: subtract `orientation` to rotate the chart (places the
   *   Ascendant at the desired position)
   * - Step 2: `180 − adjusted` converts between the coordinate systems:
   *   zodiac 0° (Aries) → canvas 180° (left / 9 o'clock); the zodiac
   *   increases counter-clockwise while the canvas increases clockwise
   *   (inverted).
   */
  zodiacToCanvasAngle(zodiacDegree: number): number {
    const adjusted = zodiacDegree - this.orientation;
    return 180 - adjusted;
  }

  /**
   * Convert a zodiac degree and radius to a canvas point.
   * Polar → Cartesian: x = cx + r·cos(θ), y = cy + r·sin(θ), with the
   * canvas angle converted from degrees to radians for cos/sin — mirroring
   * the Swift trig exactly (`angle.radians` → cos/sin).
   */
  pointForDegree(zodiacDegree: number, radius: number): Point {
    const canvasAngle = this.zodiacToCanvasAngle(zodiacDegree);
    const angleRadians = (canvasAngle * Math.PI) / 180;
    return {
      x: this.center.x + radius * Math.cos(angleRadians),
      y: this.center.y + radius * Math.sin(angleRadians),
    };
  }

  /**
   * Midpoint between two zodiac degrees, handling 360° wraparound.
   *
   * Examples: 10°→20° → 15° (simple average); 350°→10° → 0° (wraps).
   * Directional by design: the wrap branch fires only when `end < start`,
   * so the reversed pair averages the long way ((10, 350) → 180).
   *
   * See the file header for the `>=` vs Swift's `>` boundary note.
   */
  calculateMidpoint(start: number, end: number): number {
    let mid = (start + end) / 2;

    // Handle wraparound case (e.g., 350° to 10°)
    if (end < start) {
      mid = (start + (end + 360)) / 2;
      if (mid >= 360) {
        mid -= 360; // Normalize back to 0-360 range
      }
    }

    return mid;
  }
}
