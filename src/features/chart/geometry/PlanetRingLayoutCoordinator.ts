/**
 * PlanetRingLayoutCoordinator — coordinates the layout of planets in a ring,
 * handling visibility filtering and layout engine orchestration.
 * (kairos-ios `.../Viewing/Layout/PlanetRingLayoutCoordinator.swift`, 203 lines.)
 *
 * Interface difference from Swift (per the Task 6 plan): the Swift
 * coordinator's `planetRadius` takes `innerRadius`/`outerRadius` directly;
 * the TS static takes the `RingGeometry` + `ringIndex` and derives them —
 * same formula, one less place for callers to pass mismatched radii.
 *
 * Because the TS PlanetLayoutEngine returns longitudes only (plan
 * interface), this coordinator also ports the Swift engine's
 * point-construction half (`calculatePositionForLongitude`,
 * `calculateDegreeMarkPosition`, `calculateMirrorDegreeMarkPosition`,
 * PlanetLayoutEngine.swift :376-431) so `calculateLayout()` still produces
 * the full Swift `PlanetLayoutPosition` shape.
 */

import type { OverlapPreventionConfig } from "../schema/core-types";
import type { PlanetsRingStyle } from "../schema/ring-styles";
import { ChartCoordinateSystem } from "./ChartCoordinateSystem";
import { DegreeTextStack } from "./DegreeTextStack";
import {
  PlanetLayoutEngine,
  computeConnectionEndpoint,
  computeFarSideEndpoint,
  type ChartPlacement,
  type PlanetLayoutPosition,
} from "./PlanetLayoutEngine";
import { RingGeometry } from "./RingGeometry";
import type { Point } from "./types";

export class PlanetRingLayoutCoordinator {
  readonly placements: ChartPlacement[];
  readonly ringIndex: number;
  readonly chartRingNumber: number;
  readonly maxRingNumber: number;
  readonly geometry: RingGeometry;
  readonly coordinates: ChartCoordinateSystem;
  readonly style: PlanetsRingStyle;
  readonly overlapPrevention: OverlapPreventionConfig;
  /** Celestial-body names (Swift `Set<CelestialBody>`); placements whose body is absent or listed pass. */
  readonly visibleBodies: ReadonlySet<string>;
  /** Swift `selections: [AnyChartNode]` — stored but unused by layout (parity). */
  readonly selections: readonly unknown[];

  constructor(
    placements: ChartPlacement[],
    ringIndex: number,
    chartRingNumber: number,
    maxRingNumber: number,
    geometry: RingGeometry,
    coordinates: ChartCoordinateSystem,
    style: PlanetsRingStyle,
    overlapPrevention: OverlapPreventionConfig,
    visibleBodies: ReadonlySet<string>,
    selections: readonly unknown[],
  ) {
    this.placements = placements;
    this.ringIndex = ringIndex;
    this.chartRingNumber = chartRingNumber;
    this.maxRingNumber = maxRingNumber;
    this.geometry = geometry;
    this.coordinates = coordinates;
    this.style = style;
    this.overlapPrevention = overlapPrevention;
    this.visibleBodies = visibleBodies;
    this.selections = selections;
  }

  /**
   * Calculate layout positions for all visible planets.
   * Returns PlanetLayoutPosition with adjusted positions and connection info.
   */
  calculateLayout(): PlanetLayoutPosition[] {
    // Filter placements based on visibility settings
    const visiblePlacements = this.filterVisiblePlacements();

    // Calculate positions (with or without overlap prevention)
    if (this.overlapPrevention.enabled) {
      return this.calculateOverlapPreventedLayout(visiblePlacements);
    } else {
      return this.calculateExactPositions(visiblePlacements);
    }
  }

  // MARK: - Private Helpers

  private filterVisiblePlacements(): ChartPlacement[] {
    return this.placements.filter((placement) => {
      if (placement.body === undefined) {
        return true;
      }
      return this.visibleBodies.has(placement.body);
    });
  }

  /**
   * Calculate position for a given longitude at the given radius.
   * (Swift engine's `calculatePositionForLongitude` :376-384, parameterized
   * by radius since the exact path and engine path share it here.)
   */
  private calculatePositionForLongitude(longitude: number, radius: number): Point {
    return this.coordinates.pointForDegree(longitude, radius);
  }

  /**
   * Calculate primary degree-mark tip position for a given longitude.
   * Returns the *tick* position, not the planet position — the tick edge
   * is driven by `anchorFromInnerEdge`; the planet edge is driven by
   * `invertGlyphOrder` (a separate axis since the 2026-05-26 split).
   * When the two disagree, the tip and the planet sit on opposite edges.
   * (Swift engine's `calculateDegreeMarkPosition` :391-410.)
   */
  private calculateDegreeMarkPosition(
    longitude: number,
    innerRadius: number,
    outerRadius: number,
  ): Point {
    // Inner tip of the primary tick — the point closest to the planet's
    // edge when invertGlyphOrder matches anchorFromInnerEdge.
    let degreeMarkRadius: number;
    if (this.style.anchorFromInnerEdge) {
      // Primary tick on inner edge → tip extends outward to this radius.
      degreeMarkRadius = innerRadius + this.style.degreeMarkLength;
    } else {
      // Primary tick on outer edge → tip extends inward to this radius.
      degreeMarkRadius = outerRadius - this.style.degreeMarkLength;
    }
    return this.coordinates.pointForDegree(longitude, degreeMarkRadius);
  }

  /**
   * Endpoint for the mirror (opposite-edge) connection line. When
   * `showTicksOnBothEdges` is true it lands on the mirror tick's tip (inset
   * from the opposite edge by `degreeMarkLength`, matching
   * `DegreeMarkGeometry.tickRadialBounds`); otherwise there is no mirror
   * tick, so it lands on the bare opposite edge — independent of tick length.
   * (Swift engine's `calculateMirrorDegreeMarkPosition` :417-431.)
   */
  private calculateMirrorDegreeMarkPosition(
    longitude: number,
    innerRadius: number,
    outerRadius: number,
  ): Point {
    const inset = this.style.showTicksOnBothEdges ? this.style.degreeMarkLength : 0;
    let mirrorRadius: number;
    if (this.style.anchorFromInnerEdge) {
      mirrorRadius = outerRadius - inset;
    } else {
      mirrorRadius = innerRadius + inset;
    }
    return this.coordinates.pointForDegree(longitude, mirrorRadius);
  }

  private calculateOverlapPreventedLayout(
    visiblePlacements: ChartPlacement[],
  ): PlanetLayoutPosition[] {
    const outerRadius = this.geometry.radiusForRing(this.ringIndex);
    const innerRadius = this.geometry.innerRadiusForRing(this.ringIndex);

    // Per-placement stack tail offset varies with `isRetrograde`; for the
    // radius computation we use a representative value (any placement
    // works since the radius is style-wide). Overlap engine receives all
    // placements and recomputes endpoints per-placement internally.
    const representativeTailOffset = DegreeTextStack.stackTailOffset(this.style, false);
    const planetRadius = PlanetRingLayoutCoordinator.planetRadius(
      this.style,
      this.geometry,
      this.ringIndex,
      representativeTailOffset,
    );

    if (visiblePlacements.length === 0) return [];

    const layout = PlanetLayoutEngine.calculateNonOverlappingLayout(visiblePlacements, {
      radius: planetRadius,
      nudgeDistance: this.overlapPrevention.nudgeDistance,
      useGlyphs: this.style.useGlyphs,
      glyphSize: this.style.glyphSize,
      circleRadius: this.style.circleRadius,
    });

    // Port of the Swift engine's step 5 (:217-244): build layout positions.
    // `layout` comes back in the same order `visiblePlacements` went in.
    const center = this.coordinates.center;
    return visiblePlacements.map((placement, index) => {
      const originalPos = this.calculatePositionForLongitude(placement.longitude, planetRadius);
      const adjustedPos = this.calculatePositionForLongitude(
        layout[index].adjustedLongitude,
        planetRadius,
      );
      const degreeMarkPos = this.calculateDegreeMarkPosition(
        placement.longitude,
        innerRadius,
        outerRadius,
      );
      const degreeMarkMirrorPos = this.calculateMirrorDegreeMarkPosition(
        placement.longitude,
        innerRadius,
        outerRadius,
      );
      const endpoint = computeConnectionEndpoint(
        adjustedPos,
        center,
        this.style,
        placement.isRetrograde,
      );
      const farEndpoint = computeFarSideEndpoint(
        adjustedPos,
        center,
        this.style,
        placement.isRetrograde,
      );
      return {
        placement,
        originalPosition: originalPos,
        adjustedPosition: adjustedPos,
        degreeMarkPosition: degreeMarkPos,
        degreeMarkMirrorPosition: degreeMarkMirrorPos,
        connectionEndpoint: endpoint,
        farSideConnectionEndpoint: farEndpoint,
        needsConnectionLine: true,
      };
    });
  }

  private calculateExactPositions(visiblePlacements: ChartPlacement[]): PlanetLayoutPosition[] {
    const outerRadius = this.geometry.radiusForRing(this.ringIndex);
    const innerRadius = this.geometry.innerRadiusForRing(this.ringIndex);

    const representativeTailOffset = DegreeTextStack.stackTailOffset(this.style, false);
    const planetRadius = PlanetRingLayoutCoordinator.planetRadius(
      this.style,
      this.geometry,
      this.ringIndex,
      representativeTailOffset,
    );

    const center = this.coordinates.center;
    return visiblePlacements.map((placement) => {
      const position = this.calculatePositionForLongitude(placement.longitude, planetRadius);
      const degreeMarkPos = this.calculateDegreeMarkPosition(
        placement.longitude,
        innerRadius,
        outerRadius,
      );
      const degreeMarkMirrorPos = this.calculateMirrorDegreeMarkPosition(
        placement.longitude,
        innerRadius,
        outerRadius,
      );
      // Computed for consistency even though `needsConnectionLine: false`
      // suppresses the draw in this exact-positions path.
      const endpoint = computeConnectionEndpoint(
        position,
        center,
        this.style,
        placement.isRetrograde,
      );
      const farEndpoint = computeFarSideEndpoint(
        position,
        center,
        this.style,
        placement.isRetrograde,
      );
      return {
        placement,
        originalPosition: position,
        adjustedPosition: position,
        degreeMarkPosition: degreeMarkPos,
        degreeMarkMirrorPosition: degreeMarkMirrorPos,
        connectionEndpoint: endpoint,
        farSideConnectionEndpoint: farEndpoint,
        needsConnectionLine: false,
      };
    });
  }

  // MARK: - Planet radius helper

  /**
   * Computes a planet's radial position within a ring under the **anchor-
   * tied** semantic (2026-05-31).
   * (Swift `PlanetRingLayoutCoordinator.planetRadius` :183-202; radii are
   * derived from `geometry`/`ringIndex` per the Task 6 plan interface.)
   *
   * `glyphInsetFromAnchor` is the distance from the anchor's tick TIP to
   * the anchor-side end of the glyph stack. The "anchor" is the edge with
   * the primary tick (driven by `anchorFromInnerEdge`). Which end of the
   * stack faces the anchor depends on `invertGlyphOrder`:
   *   - `invertGlyphOrder = false` → planet glyph is the anchor-side end
   *     (stack walks away from anchor). Planet sits at `stackAnchorEnd`.
   *   - `invertGlyphOrder = true`  → stack tail is the anchor-side end
   *     (stack walks toward anchor). Planet sits at the far-side end,
   *     i.e. `stackAnchorEnd + stackTailOffset` (with appropriate sign).
   *
   * `showTicksOnBothEdges` does not affect the inset semantics — only the
   * anchor's tick is the reference. The secondary tick (if present) is
   * purely decorative for inset purposes.
   *
   * Direction-of-effect consistency: increasing `glyphInsetFromAnchor`
   * always pushes the planet further from the anchor edge.
   *
   * Degenerate case: when `stackTailOffset == 0` (no labels visible),
   * `invertGlyphOrder` has no effect because the planet IS the stack —
   * there is no "order" to invert. Bundled presets that previously
   * depended on `invertGlyphOrder` placing the planet on a specific edge
   * with no labels visible will visually shift; re-tuning is deferred to
   * the bundled-defaults refresh PR.
   */
  static planetRadius(
    style: PlanetsRingStyle,
    geometry: RingGeometry,
    ringIndex: number,
    stackTailOffset: number,
  ): number {
    const outerRadius = geometry.radiusForRing(ringIndex);
    const innerRadius = geometry.innerRadiusForRing(ringIndex);

    const anchorOnInner = style.anchorFromInnerEdge;
    const direction = anchorOnInner ? +1 : -1;
    const anchorTickTip = anchorOnInner
      ? innerRadius + style.degreeMarkLength
      : outerRadius - style.degreeMarkLength;

    const stackAnchorEnd = anchorTickTip + direction * style.glyphInsetFromAnchor;

    const planetOffsetFromStackAnchorEnd = style.invertGlyphOrder
      ? stackTailOffset // planet at far-side end
      : 0; // planet at anchor-side end

    return stackAnchorEnd + direction * planetOffsetFromStackAnchorEnd;
  }
}
