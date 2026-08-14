/**
 * DegreeMarkGeometry — radial tick bounds for degree marks on the planet
 * ring (the geometry half of kairos-ios
 * `.../Viewing/Wheel/Rendering/DegreeMarkRenderer.swift`).
 *
 * Degree marks are drawn at the original (true) zodiac positions, not
 * adjusted positions.
 */

import type { PlanetsRingStyle } from "../schema/ring-styles";

/** Radial start/end pair for one tick (Swift's `(start: CGFloat, end: CGFloat)` tuple). */
export interface TickRadialBounds {
  start: number;
  end: number;
}

export class DegreeMarkGeometry {
  /**
   * Returns the radial start/end pairs for ticks to render given the ring
   * geometry and style. One pair when single-tick; two pairs when
   * `showTicksOnBothEdges` is true (primary first, mirror second).
   *
   * (Swift `DegreeMarkRenderer.tickRadialBounds` :13-32, structural port.)
   */
  static tickRadialBounds(
    outerRadius: number,
    innerRadius: number,
    style: PlanetsRingStyle,
  ): TickRadialBounds[] {
    let primary: TickRadialBounds;
    if (style.anchorFromInnerEdge) {
      primary = { start: innerRadius, end: innerRadius + style.degreeMarkLength };
    } else {
      primary = { start: outerRadius, end: outerRadius - style.degreeMarkLength };
    }
    if (!style.showTicksOnBothEdges) return [primary];
    let mirror: TickRadialBounds;
    if (style.anchorFromInnerEdge) {
      mirror = { start: outerRadius, end: outerRadius - style.degreeMarkLength };
    } else {
      mirror = { start: innerRadius, end: innerRadius + style.degreeMarkLength };
    }
    return [primary, mirror];
  }
}
