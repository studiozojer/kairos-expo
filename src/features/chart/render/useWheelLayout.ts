/**
 * useWheelLayout — ALL wheel layout math, memoized. Ring components only draw.
 *
 * Composition mirrors kairos-ios `ChartWheelRenderer.chartCanvas`
 * (Features/Display/Components/ChartWheelRenderer.swift:114-170):
 *
 *   1. displayScale = DisplayScaleProvider.scale(size)  (damped power curve)
 *   2. scale every ring's style + thickness and the global chart variables
 *      (ChartConfigurationScaler — numbers scale, booleans/colors don't)
 *   3. ringThicknesses = RingGeometryBuilder.calculateRingThicknesses with the
 *      SCALED rings + SCALED globals
 *   4. RingGeometry(outerRadius = size/2 − scaled margin, thicknesses,
 *      SCALED ringGap)   — Swift: availableRadius + scaledStyle.global.ringGap
 *   5. ChartCoordinateSystem(center = canvas center, config.orientation)
 *   6. (Task 9) per-ring planet layout — every ring of kind "planets" runs
 *      through `PlanetRingLayoutCoordinator` (Task 6) against the SCALED
 *      style + geometry, keyed by ring index.
 *   7. (Task 9 fix round 1) `houseCusps` passed through from `config`
 *      verbatim — the planets ring's cusp lines need it.
 *
 * The canvas is exactly `size`×`size` and the wheel renders centered in it
 * (iOS renders at canvas center and repositions with a transform — here the
 * ChartWheel `transform` prop does that job; the local center is size/2).
 *
 * MEMO KEY WARNING (load-bearing): this hook memos on `(config, size)` by
 * identity. `buildConfiguration` returns a FRESH object per call, so callers
 * must memoize the config themselves (the route pins it with useMemo on
 * fixture+preset) or this memo never hits and every frame re-lays-out.
 */

import { useMemo } from "react";

import type { ChartRenderingConfiguration } from "../config/ChartRenderingConfiguration";
import type { RingConfiguration } from "../config/ChartRenderingConfiguration";
import type { Placement } from "../config/engine-types";
import {
  scaleAspectOverlayStyle,
  scaleGlobalChartVariables,
  scaleRingStyle,
  scaleRingThickness,
} from "../geometry/ChartConfigurationScaler";
import { ChartCoordinateSystem } from "../geometry/ChartCoordinateSystem";
import { DisplayScaleProvider } from "../geometry/DisplayScaleProvider";
import type { PlanetLayoutPosition } from "../geometry/PlanetLayoutEngine";
import { PlanetRingLayoutCoordinator } from "../geometry/PlanetRingLayoutCoordinator";
import { RingGeometry } from "../geometry/RingGeometry";
import { RingGeometryBuilder } from "../geometry/RingGeometryBuilder";
import type { GlobalChartVariables } from "../schema/core-types";
import { PLANETS_RING_STYLE_DEFAULT, PLANETS_STYLE_TYPE, type AspectOverlayStyle } from "../schema/ring-styles";

/**
 * A placement carrying both the render-side engine fields (glyph asset,
 * sign, house, …) AND the field Task 6's `PlanetLayoutEngine.ChartPlacement`
 * contract reads for visibility (`body`). Same body id, two property names —
 * Task 6's classes were written against the minimal structural
 * `ChartPlacement`; PlanetsRing (Task 9) needs the richer `Placement` back on
 * the other side, so this hook constructs objects satisfying BOTH shapes at
 * once rather than losing fields at the Task 6 boundary.
 */
export interface PlanetRenderPlacement extends Placement {
  body: string;
}

function toPlanetRenderPlacement(p: Placement): PlanetRenderPlacement {
  return { ...p, body: p.bodyId };
}

/** One ring's planet layout, in placement order — `.placement` is always a
 *  `PlanetRenderPlacement` at runtime (constructed above); typed narrowly so
 *  ring renderers don't need to cast. */
export type PlanetRingLayout = (PlanetLayoutPosition & { placement: PlanetRenderPlacement })[];

export interface WheelLayout {
  /** Canvas size in points (the canvas is square: size × size). */
  size: number;
  /** DisplayScaleProvider factor for this size. */
  displayScale: number;
  /** Rings with SCALED styles + thicknesses, outermost-first. */
  rings: RingConfiguration[];
  /** Scaled global chart variables (margin/ringGap/…). */
  global: GlobalChartVariables;
  /** Resolved thickness per ring, outermost-first. */
  ringThicknesses: number[];
  /** Radial ring layout (radii per ring index). */
  geometry: RingGeometry;
  /** Zodiac-degree → canvas-point transform (orientation applied). */
  coordinates: ChartCoordinateSystem;
  /** Planet layout, keyed by ring index — populated only for rings whose kind is "planets" (Task 9). */
  planetLayouts: ReadonlyMap<number, PlanetRingLayout>;
  /**
   * 12 house-cusp longitudes, house 1 first — passed through from
   * `config.houseCusps` verbatim (degrees, so display-scale invariant; no
   * scaling applies). Fix round 1: the planets ring's cusp lines
   * (`PlanetsRing.swift:41-74`) need this and `RingRendererProps` doesn't
   * otherwise carry it — threaded here per "all layout data lives in the
   * hook, the component only draws."
   */
  houseCusps: number[];
  /**
   * Scaled `config.aspectOverlayStyle` (Task 10) — the `AspectOverlay` reads
   * this instead of `config.aspectOverlayStyle` directly, same "scaling lives
   * in the hook" rule every ring style follows.
   */
  aspectOverlayStyle: AspectOverlayStyle;
}

export function useWheelLayout(config: ChartRenderingConfiguration, size: number): WheelLayout {
  return useMemo(() => {
    const displayScale = DisplayScaleProvider.scale(size);

    const rings = config.rings.map((ring) => ({
      ...ring,
      style: scaleRingStyle(ring.style, displayScale),
      thickness: scaleRingThickness(ring.thickness, displayScale),
    }));
    const global = scaleGlobalChartVariables(config.globalSettings, displayScale);
    const aspectOverlayStyle = scaleAspectOverlayStyle(config.aspectOverlayStyle, displayScale);

    // The Swift signature's legacy ringModules param is unused by the math
    // (RingGeometryBuilder.swift) — pass [].
    const ringThicknesses = RingGeometryBuilder.calculateRingThicknesses(size, rings, [], global);

    const outerRadius = size / 2 - global.margin;
    const geometry = new RingGeometry(outerRadius, ringThicknesses, global.ringGap);
    const coordinates = new ChartCoordinateSystem(
      { x: size / 2, y: size / 2 },
      config.orientation,
    );

    const planetLayouts = new Map<number, PlanetRingLayout>();
    rings.forEach((ring, ringIndex) => {
      if (ring.type.kind !== "planets") return;
      const style =
        ring.style.$type === PLANETS_STYLE_TYPE ? ring.style : PLANETS_RING_STYLE_DEFAULT;
      const placements = ring.type.placements.map(toPlanetRenderPlacement);
      // Swift: `Set(placements.compactMap { $0.celestialBody })` — derived
      // from the SAME (already preset-filtered) placement list passed in.
      const visibleBodies = new Set(placements.map((p) => p.body));
      const coordinator = new PlanetRingLayoutCoordinator(
        placements,
        ringIndex,
        ring.type.ringNumber,
        ring.type.maxRingNumber,
        geometry,
        coordinates,
        style,
        global.overlapPrevention,
        visibleBodies,
        [],
      );
      planetLayouts.set(ringIndex, coordinator.calculateLayout() as PlanetRingLayout);
    });

    return {
      size,
      displayScale,
      rings,
      global,
      ringThicknesses,
      geometry,
      coordinates,
      planetLayouts,
      houseCusps: config.houseCusps,
      aspectOverlayStyle,
    };
  }, [config, size]);
}
