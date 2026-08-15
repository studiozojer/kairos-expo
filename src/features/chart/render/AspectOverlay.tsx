/**
 * AspectOverlay — aspect lines connecting celestial bodies, drawn last (on
 * top of every ring). Port of kairos-ios
 * `.../Viewing/Overlays/AspectOverlay.swift` (+`+PathCalculation.swift`,
 * `+Styling.swift`). Not a ring — Swift's `AspectOverlay` implements
 * `ChartOverlay`, a distinct protocol from `SelectionAwareChartRing`, drawn
 * in a separate pass after all rings (`ChartWheelRenderer.swift`: rings,
 * then overlays) — mirrored here as a component `ChartWheel.tsx` renders
 * after its `RING_RENDERERS` map, inside the same transformed `Group`.
 *
 * The per-edge filtering (`AspectFilterResult.evaluate`) lives in
 * `geometry/AspectFilter.ts`. The strength sort + `maximumAspectCount` cap
 * stay HERE (`selectAspectsToRender`), matching Swift's own split — the cap
 * is `AspectOverlay.swift:111-119`'s concern, not `AspectFilterResult`'s.
 *
 * SELECTION: this codebase has no selection system yet (plan's self-review:
 * out of scope by design), so `selectedIdentifiers` is always empty and
 * `ringCount`/`fromRing`/`toRing` are always `1` — the solo wheel has one
 * ring of placements. See AspectFilter.ts's module header for why this is a
 * safe simplification of the Swift signature, not a behavior change.
 */

import React, { useMemo } from "react";

import { Circle, DashPathEffect, Group, Path, Skia, type SkPath } from "@shopify/react-native-skia";

import type { Theme } from "@/theme";

import type { ChartRenderingConfiguration, RingConfiguration } from "../config/ChartRenderingConfiguration";
import type { AspectEdgeDTO, Placement } from "../config/engine-types";
import {
  calculateBezierControlPoint,
  evaluateAspectFilter,
  type ResolvedAspectType,
} from "../geometry/AspectFilter";
import type { Point } from "../geometry/types";
import type { ChartColors } from "../schema/core-types";
import type { AspectHues, AspectOverlayStyle } from "../schema/ring-styles";
import { celestialBodyColor, resolveColorValue, useChartPaintTheme, withAlphaFactor } from "./colors";
import type { WheelLayout } from "./useWheelLayout";

const RED_OPAQUE = "#ff0000ff";
const EMPTY_SELECTION: ReadonlySet<string> = new Set();

/** One aspect that passed every `AspectFilterResult.evaluate` filter, with
 *  its resolved endpoints — ready for the sort/cap step. */
export interface ValidAspect {
  edge: AspectEdgeDTO;
  aspectType: ResolvedAspectType;
  fromPlacement: Placement;
  toPlacement: Placement;
}

function collectPlanetPlacements(rings: readonly RingConfiguration[]): Placement[] {
  const out: Placement[] = [];
  for (const ring of rings) {
    if (ring.type.kind === "planets") out.push(...ring.type.placements);
  }
  return out;
}

/**
 * Sort-by-strength + cap, applied ONLY when `maximumAspectCount > 0` (Swift
 * `AspectOverlay.swift:114-119`, `if maxCount > 0`). **0 = unlimited**: at 0
 * — or whenever the valid set already fits under the cap — the input order
 * (engine edge order, already filtered) is returned completely untouched.
 * Do NOT sort unconditionally: the default configuration ships
 * `maximumAspectCount: 0`, and sorting there would diverge from iOS's draw
 * order on sight (pinned by review fix e852608).
 */
export function selectAspectsToRender(
  validAspects: readonly ValidAspect[],
  maximumAspectCount: number,
): readonly ValidAspect[] {
  if (maximumAspectCount > 0 && validAspects.length > maximumAspectCount) {
    return [...validAspects]
      .sort((a, b) => b.edge.strength - a.edge.strength)
      .slice(0, maximumAspectCount);
  }
  return validAspects;
}

/** Swift `AspectOverlay+Styling.swift`'s `aspectColor(for:from:style:chartColors:)`. */
export function aspectColor(
  aspectType: ResolvedAspectType,
  fromPlacement: Placement,
  style: AspectOverlayStyle,
  colors: ChartColors,
  theme: Theme,
): string {
  let base: string;
  switch (style.colorMode) {
    case "byType": {
      // AspectHues field names are exactly the enums.gen camelCase keys
      // (verified: conjunction/opposition/trine/square/sextile/quincunx/
      // semiSextile/semiSquare/sesquiquadrate/quintile/biquintile).
      const hue = style.aspectHues[aspectType.key as keyof AspectHues];
      base = resolveColorValue({ source: "hue", value: hue, layer: "primitive" }, theme);
      break;
    }
    case "byCelestial":
      base = celestialBodyColor(fromPlacement.bodyId, colors, theme);
      break;
    case "monochrome":
    default:
      base = resolveColorValue(style.monochromeColor, theme);
      break;
  }
  return withAlphaFactor(base, style.opacity);
}

function straightPath(from: Point, to: Point): SkPath {
  const builder = Skia.PathBuilder.Make();
  builder.moveTo(from.x, from.y);
  builder.lineTo(to.x, to.y);
  return builder.build();
}

function bezierPath(from: Point, to: Point, control: Point): SkPath {
  const builder = Skia.PathBuilder.Make();
  builder.moveTo(from.x, from.y);
  builder.quadTo(control.x, control.y, to.x, to.y);
  return builder.build();
}

export interface AspectOverlayProps {
  config: ChartRenderingConfiguration;
  layout: WheelLayout;
}

export function AspectOverlay({ config, layout }: AspectOverlayProps) {
  const theme = useChartPaintTheme();
  const style = layout.aspectOverlayStyle;

  const validAspects = useMemo(() => {
    if (!config.aspects.enabled) return [];

    const placements = collectPlanetPlacements(layout.rings);
    const placementMap = new Map(placements.map((p) => [p.id, p]));
    const visibleBodyIds = new Set(placements.map((p) => p.bodyId));

    const out: ValidAspect[] = [];
    for (const edge of config.aspectEdges) {
      // Placement lookup happens BEFORE evaluate — Swift's
      // `guard let fromPlacement = placementMap[aspect.from], ... else { continue }`.
      // AspectFilterResult never produces `placementsNotFound`; this IS that check.
      const fromPlacement = placementMap.get(edge.from);
      const toPlacement = placementMap.get(edge.to);
      if (!fromPlacement || !toPlacement) continue;

      const result = evaluateAspectFilter({
        aspect: edge,
        fromPlacement,
        toPlacement,
        aspects: config.aspects,
        style,
        fromVisibleBodies: visibleBodyIds,
        toVisibleBodies: visibleBodyIds,
        selectedIdentifiers: EMPTY_SELECTION,
        ringCount: 1,
        fromRing: 1,
        toRing: 1,
      });
      if (!result.shouldRender || !result.aspectType) continue;

      out.push({ edge, aspectType: result.aspectType, fromPlacement, toPlacement });
    }
    return out;
  }, [config.aspects, config.aspectEdges, layout.rings, style]);

  const rendered = useMemo(
    () => selectAspectsToRender(validAspects, style.maximumAspectCount),
    [validAspects, style.maximumAspectCount],
  );

  if (!config.aspects.enabled || rendered.length === 0) return null;

  const { coordinates, geometry, ringThicknesses } = layout;
  // Swift `geometry.innerRadiusForRing(at: geometry.ringThicknesses.count - 1)`
  // — the innermost radius of the whole wheel, regardless of which ring
  // that is.
  const aspectRadius = geometry.innerRadiusForRing(ringThicknesses.length - 1);

  return (
    <Group>
      {rendered.map((va) => {
        const fromPoint = coordinates.pointForDegree(va.fromPlacement.longitude, aspectRadius);
        const toPoint = coordinates.pointForDegree(va.toPlacement.longitude, aspectRadius);
        const key = `${va.edge.from}-${va.edge.to}-${va.aspectType.wireName}`;

        // Conjunctions draw as a small dot at the midpoint, not a line
        // (Swift `drawConjunctionMarker`).
        if (va.aspectType.key === "conjunction") {
          const dotRadius = style.lineWidth * 2;
          return (
            <Circle
              key={key}
              cx={(fromPoint.x + toPoint.x) / 2}
              cy={(fromPoint.y + toPoint.y) / 2}
              r={dotRadius}
              color={withAlphaFactor(RED_OPAQUE, style.opacity)}
            />
          );
        }

        const color = aspectColor(va.aspectType, va.fromPlacement, style, config.colors, theme);
        let path: SkPath;
        if (style.renderMode === "bezier") {
          const control = calculateBezierControlPoint(
            fromPoint,
            toPoint,
            coordinates.center,
            style.bezierCurveStrength,
          );
          path = control ? bezierPath(fromPoint, toPoint, control) : straightPath(fromPoint, toPoint);
        } else {
          path = straightPath(fromPoint, toPoint);
        }

        const dashed = style.useDashedForSeparating && !va.edge.is_applying;
        if (dashed) {
          return (
            <Path key={key} path={path} style="stroke" strokeWidth={style.lineWidth} color={color}>
              <DashPathEffect intervals={style.dashPattern} />
            </Path>
          );
        }
        return <Path key={key} path={path} style="stroke" strokeWidth={style.lineWidth} color={color} />;
      })}
    </Group>
  );
}
