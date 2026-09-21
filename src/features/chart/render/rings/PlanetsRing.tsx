/**
 * PlanetsRing — glyphs, degree/minute/sign/℞ stacks, PAV-adjusted positions,
 * connection lines to true-position ticks. Port of kairos-ios
 * `.../Viewing/Wheel/Rings/PlanetsRing.swift` (draw loop) +
 * `.../Rendering/PlanetGlyphRenderer.swift` (glyph/circle/connection-line
 * primitives) + `.../Rendering/DegreeTextRenderer.swift` (stack draw, Task 6
 * ported the geometry half as `DegreeTextStack`) +
 * `.../Rendering/DegreeMarkRenderer.swift` (ticks, Task 6 ported the geometry
 * half as `DegreeMarkGeometry`).
 *
 * SCOPE: originally read narrowly against the Task 9 plan's stated
 * interface (anchor ticks, glyph + degree stack, connection lines only).
 * Fix round 1 (controller ruling) widened this: the ring's own chrome — a
 * background fill, cusp lines, and inner/outer boundary strokes — is drawn
 * too, matching `PlanetsRing.swift`'s full render order. `classic.json` sets
 * `showCuspLines: true` + `innerBoundaryLineWidth: 0.5`; `modern.json` sets a
 * `backgroundColor` — none of this was dormant.
 *
 * ALL POSITION MATH lives in `useWheelLayout` (`PlanetRingLayoutCoordinator`,
 * Task 6) — this component only reads `layout.planetLayouts` and draws.
 *
 * DEGREE-MARK GATE (faithful-but-odd): Swift's actual draw gate is
 * `ringStyle.degreeMarkLength > 0` (PlanetsRing.swift:197) — the
 * `showDegreeMarks` style FIELD is decoded but never read by the render
 * path (verified: grep across PlanetsRing.swift + DegreeMarkRenderer.swift
 * turns up zero references to `showDegreeMarks`). Mirrored verbatim, not
 * "fixed" — this is a dead style knob, not a wrong computed value.
 *
 * Selection opacity follows the preset flags; selected bodies can draw a
 * background highlight. Static previews have no selection.
 */

import { selectionOpacity, selectionColor, cuspSelectionOpacity, type SelectionPaint } from "../../interaction/selection";
import React, { useMemo } from "react";

import {
  Circle,
  Shadow,
  DashPathEffect,
  Group,
  Path,
  Skia,
  Text,
  useFont,
  type SkFont,
  type SkPath,
} from "@shopify/react-native-skia";

import { families, fontMap } from "@/theme/fonts.gen";
import type { Theme } from "@/theme";

import { degreesInSign, minutesInSign } from "../../config/engine-types";
import { DegreeMarkGeometry } from "../../geometry/DegreeMarkGeometry";
import { DegreeTextStack, type StackElement } from "../../geometry/DegreeTextStack";
import type { Point } from "../../geometry/types";
import { ZODIAC_SIGNS } from "../../schema/enums.gen";
import type { ChartColors } from "../../schema/core-types";
import { PLANETS_RING_STYLE_DEFAULT, PLANETS_STYLE_TYPE, type PlanetsRingStyle } from "../../schema/ring-styles";
import type { RingRendererProps } from "../ChartWheel";
import { celestialBodyColor, resolveColorValue, useChartPaintTheme, withAlphaFactor } from "../colors";
import { Glyph } from "../Glyph";
import type { GlyphName } from "../glyph-map.gen";
import type { PlanetRenderPlacement } from "../useWheelLayout";

const CONNECTION_DASH = [2, 2];

function linePath(from: Point, to: Point): SkPath {
  const builder = Skia.PathBuilder.Make();
  builder.moveTo(from.x, from.y);
  builder.lineTo(to.x, to.y);
  return builder.build();
}

/**
 * Annulus (outer circle minus inner circle) fill path — Swift
 * `PlanetsRing.drawRingBackground` (:274-304) builds this via two opposite-
 * winding `addArc` calls; two `addCircle`s + an even-odd fill rule (rendered
 * with `fillType="evenOdd"`) is the equivalent hole-punch, independent of
 * winding direction.
 */
function ringBackgroundPath(cx: number, cy: number, outerR: number, innerR: number): SkPath {
  const builder = Skia.PathBuilder.Make();
  builder.addCircle(cx, cy, outerR);
  builder.addCircle(cx, cy, innerR);
  return builder.build();
}

/** Full-circle boundary stroke path — Swift `drawCircleBoundary` (:253-272). */
function circlePath(cx: number, cy: number, r: number): SkPath {
  const builder = Skia.PathBuilder.Make();
  builder.addCircle(cx, cy, r);
  return builder.build();
}

/**
 * Cusp-line color: angular cusps (houses 1/4/7/10) prefer
 * `angularCuspLineColor`, falling back to `cuspLineColor`, falling back to
 * `bd/primary`; non-angular cusps skip straight to `cuspLineColor` ??
 * `bd/primary`. (Swift `drawCuspLineWithAppearance`, PlanetsRing.swift:456-464.)
 */
export function cuspLineColor(isAngular: boolean, style: PlanetsRingStyle, theme: Theme): string {
  if (isAngular && style.angularCuspLineColor) return resolveColorValue(style.angularCuspLineColor, theme);
  if (style.cuspLineColor) return resolveColorValue(style.cuspLineColor, theme);
  return theme.color.bdPrimary;
}

/** Boundary-stroke color: `style.boundaryLineColor ?? bd/primary`. (Swift `drawCircleBoundary`.) */
export function boundaryLineColor(style: PlanetsRingStyle, theme: Theme): string {
  if (style.boundaryLineColor) return resolveColorValue(style.boundaryLineColor, theme);
  return theme.color.bdPrimary;
}

/**
 * Direction unit vector the degree-text stack walks, away from the planet
 * center. (Swift `DegreeTextRenderer.drawDegreeMinuteText`'s XOR, :142-157.)
 * Returns null when the planet sits exactly at the chart center (Swift's
 * `guard distance > 0 else { return }`).
 */
function stackDirection(
  adjustedPosition: Point,
  center: Point,
  style: PlanetsRingStyle,
): { unitX: number; unitY: number } | null {
  const dx = adjustedPosition.x - center.x;
  const dy = adjustedPosition.y - center.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance <= 0) return null;
  const directionMultiplier = style.invertGlyphOrder !== style.anchorFromInnerEdge ? 1 : -1;
  return { unitX: (directionMultiplier * dx) / distance, unitY: (directionMultiplier * dy) / distance };
}

/** Swift `PlanetsRing.textColor(for:ringStyle:)` (:485-493). */
function degreeTextColor(placement: PlanetRenderPlacement, style: PlanetsRingStyle, theme: Theme): string {
  if (placement.isRetrograde) return theme.color.txError;
  if (style.degreeTextColor) return resolveColorValue(style.degreeTextColor, theme);
  return theme.color.icPrimary;
}

/**
 * The glyph/circle/connection-line color for a placement — Swift's
 * `defaultGlyphColor = ringStyle.glyphColor?.color ?? celestialBodyColor(for:
 * placement, chartColors: style.colors)` (PlanetsRing.swift:134), reused for
 * BOTH the glyph fill and the connection line's color (:139, :146, :153,
 * :167). Distinct from degree-mark tick color, which Swift's
 * `DegreeMarkRenderer` computes straight from `celestialBodyColor` with NO
 * `glyphColor` override (PlanetsRing.swift's `degreeMarkData` map) — ticks
 * keep calling `celestialBodyColor` directly, not this helper.
 */
export function defaultGlyphColor(
  placement: PlanetRenderPlacement,
  style: PlanetsRingStyle,
  colors: ChartColors,
  theme: Theme,
): string {
  if (style.glyphColor) return resolveColorValue(style.glyphColor, theme);
  return celestialBodyColor(placement.body, colors, theme);
}

/** Centered text origin via font metrics — Skia `Text`'s x/y is the
 * baseline-left origin; Swift's `context.draw(_, at:, anchor: .center)`
 * centers on both axes. Returns null when the font isn't ready (mirrors
 * `Glyph`'s "draw nothing until ready" precedent) or metrics can't be read
 * (defensive — the jest Skia mock's degenerate zero-size font). */
function centeredTextOrigin(font: SkFont, text: string, center: Point): Point | null {
  try {
    const width = font.measureText(text).width;
    const { ascent, descent } = font.getMetrics();
    return { x: center.x - width / 2, y: center.y - (ascent + descent) / 2 };
  } catch {
    return null;
  }
}

function CenteredText({
  text,
  center,
  font,
  color,
}: {
  text: string;
  center: Point;
  font: SkFont | null;
  color: string;
}) {
  if (!font) return null;
  const origin = centeredTextOrigin(font, text, center);
  if (!origin) return null;
  return <Text text={text} x={origin.x} y={origin.y} font={font} color={color} />;
}

/** One element of the degree/sign/minute/℞ stack, already positioned. */
function StackElementView({
  element,
  center,
  placement,
  style,
  colors,
  theme,
  degreesFont,
  minutesFont,
  selection,
}: {
  element: StackElement;
  center: Point;
  placement: PlanetRenderPlacement;
  style: PlanetsRingStyle;
  colors: ChartColors;
  theme: Theme;
  degreesFont: SkFont | null;
  minutesFont: SkFont | null;
  selection?: SelectionPaint;
}) {
  switch (element.kind) {
    case "degrees":
      return (
        <CenteredText
          text={`${degreesInSign(placement.longitude)}°`}
          center={center}
          font={degreesFont}
          color={selectionColor(selection, placement.id, "affectsDegreeText", degreeTextColor(placement, style, theme), theme)}
        />
      );
    case "minutes":
      return (
        <CenteredText
          text={`${String(minutesInSign(placement.longitude)).padStart(2, "0")}'`}
          center={center}
          font={minutesFont}
          color={selectionColor(selection, placement.id, "affectsDegreeText", degreeTextColor(placement, style, theme), theme)}
        />
      );
    case "sign": {
      const signIndex = ZODIAC_SIGNS.findIndex(
        (s) => s === placement.signPlacement.toLowerCase(),
      );
      // Swift `ZodiacSign(rawValue:)` failing just skips this element — the
      // rest of the stack's positions were already fixed independent of it.
      if (signIndex < 0) return null;
      const signColor = style.signGlyphColor
        ? resolveColorValue(style.signGlyphColor, theme)
        : resolveColorValue(
            {
              source: "hue",
              value: colors.zodiacColors.zodiacHues.signs[signIndex] ?? "red",
              layer: "ic",
            },
            theme,
          );
      return (
        <Glyph
          name={`signs/${ZODIAC_SIGNS[signIndex]}` as GlyphName}
          size={element.size}
          color={signColor}
          opacity={selectionOpacity(selection, placement.id, "affectsDegreeText")}
          x={center.x}
          y={center.y}
        />
      );
    }
    case "retrograde":
      return (
        <Glyph opacity={selectionOpacity(selection, placement.id, "affectsDegreeText")} name="rx" size={element.size} color={theme.color.txError} x={center.x} y={center.y} />
      );
  }
}

export function PlanetsRing({ ring, ringIndex, layout, colors, selection }: RingRendererProps) {
  const theme = useChartPaintTheme();
  const style: PlanetsRingStyle =
    ring.style.$type === PLANETS_STYLE_TYPE ? ring.style : PLANETS_RING_STYLE_DEFAULT;

  // Two fixed font sizes ring-wide (minutes render at 80% of the degrees
  // size, DegreeTextStack.stackElements) — loaded once, not per placement.
  const fraktion = fontMap[families.fraktion.book];
  const degreesFont = useFont(fraktion, style.degreeTextFontSize);
  const minutesFont = useFont(fraktion, style.degreeTextFontSize * 0.8);

  const { geometry, coordinates } = layout;
  const positions = layout.planetLayouts.get(ringIndex) ?? [];
  const center = coordinates.center;

  const outerR = geometry.radiusForRing(ringIndex);
  const innerR = geometry.innerRadiusForRing(ringIndex);

  // Degree-mark tick bounds are style-wide (not per-placement) — one/two
  // (start, end) radial pairs shared by every tick.
  const tickBounds = useMemo(
    () => DegreeMarkGeometry.tickRadialBounds(outerR, innerR, style),
    [outerR, innerR, style],
  );

  return (
    <Group>
      {/* Ring background fill (Swift PlanetsRing.swift:28-39, :274-304) — only
          when a custom color is set. */}
      {style.backgroundColor && (
        <Path
          path={ringBackgroundPath(center.x, center.y, outerR, innerR)}
          style="fill"
          fillType="evenOdd"
          color={resolveColorValue(style.backgroundColor, theme)}
        />
      )}

      {/* Both boundaries of each selected/related house stay prominent. */}
      {style.showCuspLines &&
        (ring.houseCusps ?? layout.houseCusps).map((cuspDegree, index) => {
          const isAngular = [1, 4, 7, 10].includes(index + 1);
          const angle = coordinates.zodiacToCanvasAngle(cuspDegree);
          const rad = (angle * Math.PI) / 180;
          const outerPoint: Point = {
            x: center.x + outerR * Math.cos(rad),
            y: center.y + outerR * Math.sin(rad),
          };
          const innerPoint: Point = {
            x: center.x + innerR * Math.cos(rad),
            y: center.y + innerR * Math.sin(rad),
          };
          return (
            <Path
              opacity={cuspSelectionOpacity(selection, index, ring.chartInstanceId)}
              key={`cusp-${index}`}
              path={linePath(outerPoint, innerPoint)}
              style="stroke"
              strokeWidth={isAngular ? style.angularCuspLineWidth : style.cuspLineWidth}
              color={cuspLineColor(isAngular, style, theme)}
            />
          );
        })}

      {positions.map((pos) => {
        const placement = pos.placement;
        const color = selectionColor(selection, placement.id, "affectsGlyphs", defaultGlyphColor(placement, style, colors, theme), theme);
        const dir = stackDirection(pos.adjustedPosition, center, style);
        const elements = DegreeTextStack.stackElements(style, placement.isRetrograde);

        return (
          <React.Fragment key={placement.id}>
            {selection?.selected.has(placement.id) && selection.style.showBackgroundCircle && <Circle
              cx={pos.adjustedPosition.x} cy={pos.adjustedPosition.y} r={style.useGlyphs ? style.glyphSize * .9 : style.circleRadius * 1.8}
              color={theme.color.bgSecondary} opacity={.5} />}
            <Group opacity={selectionOpacity(selection, placement.id, "affectsGlyphs")}>
            {/* Connection line drawn BEFORE the glyph so it sits behind it
                (Swift PlanetsRing.swift:137-156). */}
            {pos.needsConnectionLine && (
              <>
                <Path
                  path={linePath(pos.connectionEndpoint, pos.degreeMarkPosition)}
                  style="stroke"
                  strokeWidth={style.connectionLineWidth}
                  strokeCap="round"
                  color={withAlphaFactor(color, 0.5)}>
                  <DashPathEffect intervals={CONNECTION_DASH} />
                </Path>
                {style.showConnectionOnBothEdges && (
                  <Path
                    path={linePath(pos.farSideConnectionEndpoint, pos.degreeMarkMirrorPosition)}
                    style="stroke"
                    strokeWidth={style.connectionLineWidth}
                    strokeCap="round"
                    color={withAlphaFactor(color, 0.5)}>
                    <DashPathEffect intervals={CONNECTION_DASH} />
                  </Path>
                )}
              </>
            )}

            {style.useGlyphs ? (
              <Glyph
                opacity={selectionOpacity(selection, placement.id, "affectsGlyphs")}
                selected={selection?.selected.has(placement.id)}
                name={`celestials/${placement.glyphAsset}` as GlyphName}
                size={style.glyphSize}
                color={color}
                x={pos.adjustedPosition.x}
                y={pos.adjustedPosition.y}
              />
            ) : (
              <Circle cx={pos.adjustedPosition.x} cy={pos.adjustedPosition.y} r={style.circleRadius} color={color}>
                {selection?.selected.has(placement.id) && <Shadow dx={0} dy={1} blur={2} color="rgba(0,0,0,0.1)" />}
              </Circle>
            )}

            </Group>
            <Group opacity={selectionOpacity(selection, placement.id, "affectsDegreeText")}>
            {dir &&
              elements.map((element, i) => (
                <StackElementView
                  key={`${placement.id}-stack-${i}`}
                  element={element}
                  center={{
                    x: pos.adjustedPosition.x + dir.unitX * element.centerOffset,
                    y: pos.adjustedPosition.y + dir.unitY * element.centerOffset,
                  }}
                  placement={placement}
                  style={style}
                  colors={colors}
                  theme={theme}
                  selection={selection}
                  degreesFont={degreesFont}
                  minutesFont={minutesFont}
                />
              ))}
            </Group>
          </React.Fragment>
        );
      })}

      {/* Degree marks (anchor ticks) — a separate pass over ALL positions,
          drawn at the TRUE longitude, not the PAV-adjusted one (Swift
          PlanetsRing.swift:196-220; degree-mark gate note above). */}
      {style.degreeMarkLength > 0 &&
        positions.map((pos) => {
          const placement = pos.placement;
          const color = selectionColor(selection, placement.id, "affectsDegreeMarks", celestialBodyColor(placement.body, colors, theme), theme);
          const angle = coordinates.zodiacToCanvasAngle(placement.longitude);
          const rad = (angle * Math.PI) / 180;
          return tickBounds.map((bounds, i) => {
            const start: Point = {
              x: center.x + bounds.start * Math.cos(rad),
              y: center.y + bounds.start * Math.sin(rad),
            };
            const end: Point = {
              x: center.x + bounds.end * Math.cos(rad),
              y: center.y + bounds.end * Math.sin(rad),
            };
            return (
              <Path
                opacity={selectionOpacity(selection, placement.id, "affectsDegreeMarks")}
                key={`${placement.id}-tick-${i}`}
                path={linePath(start, end)}
                style="stroke"
                strokeWidth={style.degreeMarkWidth}
                color={color}
              />
            );
          });
        })}

      {/* Boundary strokes (Swift :222-246, :253-272) — outer then inner,
          each gated on its own width > 0. */}
      {style.outerBoundaryLineWidth > 0 && (
        <Path
          path={circlePath(center.x, center.y, outerR)}
          style="stroke"
          strokeWidth={style.outerBoundaryLineWidth}
          color={boundaryLineColor(style, theme)}
        />
      )}
      {style.innerBoundaryLineWidth > 0 && (
        <Path
          path={circlePath(center.x, center.y, innerR)}
          style="stroke"
          strokeWidth={style.innerBoundaryLineWidth}
          color={boundaryLineColor(style, theme)}
        />
      )}
    </Group>
  );
}
