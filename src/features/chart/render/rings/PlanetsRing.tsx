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
 * SCOPE (per the Task 9 plan's stated interface — verified against
 * `kairos/specs/2026-08-12-chart-wheel-foundation-plan.md`): anchor ticks,
 * glyph + degree stack, connection lines. Swift's `PlanetsRing.render` ALSO
 * draws a ring background fill, cusp lines (reading a `houseCusps` prop this
 * shell's `RingRendererProps` doesn't carry), and inner/outer boundary
 * strokes — none of those are named in Task 9's "Produces" list, and no
 * later task in the plan claims them for the planets ring either. Left
 * undrawn, matching the shell's established precedent (ZodiacSignsRing
 * likewise deliberately drops selection machinery it isn't asked to port).
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
 * SELECTION: not ported here, same precedent as ZodiacSignsRing (Task 8) —
 * every placement always draws at "default" appearance (full opacity, no
 * dimming, no press/selection background or shadow).
 */

import React, { useMemo } from "react";

import {
  Circle,
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
}: {
  element: StackElement;
  center: Point;
  placement: PlanetRenderPlacement;
  style: PlanetsRingStyle;
  colors: ChartColors;
  theme: Theme;
  degreesFont: SkFont | null;
  minutesFont: SkFont | null;
}) {
  switch (element.kind) {
    case "degrees":
      return (
        <CenteredText
          text={`${degreesInSign(placement.longitude)}°`}
          center={center}
          font={degreesFont}
          color={degreeTextColor(placement, style, theme)}
        />
      );
    case "minutes":
      return (
        <CenteredText
          text={`${String(minutesInSign(placement.longitude)).padStart(2, "0")}'`}
          center={center}
          font={minutesFont}
          color={degreeTextColor(placement, style, theme)}
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
          x={center.x}
          y={center.y}
        />
      );
    }
    case "retrograde":
      return (
        <Glyph name="rx" size={element.size} color={theme.color.txError} x={center.x} y={center.y} />
      );
  }
}

export function PlanetsRing({ ring, ringIndex, layout, colors }: RingRendererProps) {
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
      {positions.map((pos) => {
        const placement = pos.placement;
        const color = celestialBodyColor(placement.body, colors, theme);
        const dir = stackDirection(pos.adjustedPosition, center, style);
        const elements = DegreeTextStack.stackElements(style, placement.isRetrograde);

        return (
          <React.Fragment key={placement.id}>
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
                name={`celestials/${placement.glyphAsset}` as GlyphName}
                size={style.glyphSize}
                color={color}
                x={pos.adjustedPosition.x}
                y={pos.adjustedPosition.y}
              />
            ) : (
              <Circle cx={pos.adjustedPosition.x} cy={pos.adjustedPosition.y} r={style.circleRadius} color={color} />
            )}

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
                  degreesFont={degreesFont}
                  minutesFont={minutesFont}
                />
              ))}
          </React.Fragment>
        );
      })}

      {/* Degree marks (anchor ticks) — a separate pass over ALL positions,
          drawn at the TRUE longitude, not the PAV-adjusted one (Swift
          PlanetsRing.swift:196-220; degree-mark gate note above). */}
      {style.degreeMarkLength > 0 &&
        positions.map((pos) => {
          const placement = pos.placement;
          const color = celestialBodyColor(placement.body, colors, theme);
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
                key={`${placement.id}-tick-${i}`}
                path={linePath(start, end)}
                style="stroke"
                strokeWidth={style.degreeMarkWidth}
                color={color}
              />
            );
          });
        })}
    </Group>
  );
}
