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
import {
  scaleGlobalChartVariables,
  scaleRingStyle,
  scaleRingThickness,
} from "../geometry/ChartConfigurationScaler";
import { ChartCoordinateSystem } from "../geometry/ChartCoordinateSystem";
import { DisplayScaleProvider } from "../geometry/DisplayScaleProvider";
import { RingGeometry } from "../geometry/RingGeometry";
import { RingGeometryBuilder } from "../geometry/RingGeometryBuilder";
import type { GlobalChartVariables } from "../schema/core-types";

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

    // The Swift signature's legacy ringModules param is unused by the math
    // (RingGeometryBuilder.swift) — pass [].
    const ringThicknesses = RingGeometryBuilder.calculateRingThicknesses(size, rings, [], global);

    const outerRadius = size / 2 - global.margin;
    const geometry = new RingGeometry(outerRadius, ringThicknesses, global.ringGap);
    const coordinates = new ChartCoordinateSystem(
      { x: size / 2, y: size / 2 },
      config.orientation,
    );

    return { size, displayScale, rings, global, ringThicknesses, geometry, coordinates };
  }, [config, size]);
}
