/**
 * CuspAnnotationRing — sign glyph + degree/minute annotation stacked
 * tangentially at each house cusp. Port of kairos-ios
 * `.../Viewing/Wheel/Rings/CuspAnnotationRing.swift`.
 *
 * SIGN DERIVATION: Swift reads `houseNode.signOnCusp` (a string carried on
 * the engine's `HouseNodeDTO`). `ChartRenderingConfiguration.houseCusps`
 * only carries cusp longitudes (Task 7), not the full house-node payload —
 * so this port derives the sign directly from the longitude
 * (`floor(longitude / 30) % 12`), which is mathematically identical to the
 * engine's own `sign_on_cusp` (verified against every cusp in the
 * sibly-1776 fixture: `sign_on_cusp` always equals `floor(cusp_longitude /
 * 30)`). No behavioral difference, one fewer field to thread through.
 *
 * FONT NOTE: Swift draws the degrees/minutes text with `Font.system(size:)`
 * — no custom family. Skia has no "system font" concept reachable from a
 * bundled typeface here; this port follows the PlanetsRing.tsx precedent
 * (Task 9, which also substitutes the fraktion mono family for Swift's
 * degree-stack text) and uses `families.fraktion.book` throughout.
 *
 * `showSignGlyph`/`showDegrees`/`showMinutes` (`CuspAnnotationsContent`) are
 * NOT consulted here, matching Swift: `CuspAnnotationRing.swift`'s render
 * loop never branches on those content flags either (and
 * `RingConfiguration` doesn't carry ring `content` at all — Task 7 only
 * threads `style`, same as every other ring).
 */

import React from "react";

import { Group, Path, Skia, Text, useFont, type SkFont, type SkPath } from "@shopify/react-native-skia";

import { families, fontMap } from "@/theme/fonts.gen";

import { degreesInSign, minutesInSign } from "../../config/engine-types";
import type { Point } from "../../geometry/types";
import { ZODIAC_SIGNS } from "../../schema/enums.gen";
import {
  CUSP_ANNOTATIONS_STYLE_DEFAULT,
  CUSP_ANNOTATIONS_STYLE_TYPE,
  type CuspAnnotationsStyle,
} from "../../schema/ring-styles";
import type { RingRendererProps } from "../ChartWheel";
import { resolveColorValue, useChartPaintTheme } from "../colors";
import { Glyph } from "../Glyph";
import type { GlyphName } from "../glyph-map.gen";

function circlePath(cx: number, cy: number, r: number): SkPath {
  const builder = Skia.PathBuilder.Make();
  builder.addCircle(cx, cy, r);
  return builder.build();
}

/** Annulus fill path — same construction as PlanetsRing's `ringBackgroundPath`. */
function ringBackgroundPath(cx: number, cy: number, outerR: number, innerR: number): SkPath {
  const builder = Skia.PathBuilder.Make();
  builder.addCircle(cx, cy, outerR);
  builder.addCircle(cx, cy, innerR);
  return builder.build();
}

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

/**
 * Swift `isInUpperRegion` (CuspAnnotationRing.swift:246-250): canvas angles
 * in [190°, 360°) ∪ [0°, 10°) are "upper" — the 10° offset from true
 * horizontal improves visual balance near the horizon. Keeps degrees always
 * visually left-most, minutes always right-most.
 */
export function isInUpperRegion(canvasAngleDeg: number): boolean {
  let degrees = canvasAngleDeg % 360;
  if (degrees < 0) degrees += 360;
  return degrees >= 190 || degrees < 10;
}

export function CuspAnnotationRing({ ring, ringIndex, layout, colors }: RingRendererProps) {
  const theme = useChartPaintTheme();
  const style: CuspAnnotationsStyle =
    ring.style.$type === CUSP_ANNOTATIONS_STYLE_TYPE ? ring.style : CUSP_ANNOTATIONS_STYLE_DEFAULT;

  const fraktion = fontMap[families.fraktion.book];
  const degreesFont = useFont(fraktion, style.degreesFontSize);
  const minutesFont = useFont(fraktion, style.minutesFontSize);

  const { geometry, coordinates } = layout;
  const houseCusps = ring.houseCusps ?? layout.houseCusps;
  const outerR = geometry.radiusForRing(ringIndex);
  const innerR = geometry.innerRadiusForRing(ringIndex);
  const midR = geometry.midRadiusForRing(ringIndex);
  const center = coordinates.center;

  const textColor = style.textColor ? resolveColorValue(style.textColor, theme) : theme.color.txSecondary;
  const boundaryColor = style.boundaryLineColor
    ? resolveColorValue(style.boundaryLineColor, theme)
    : theme.color.bdPrimary;

  return (
    <Group>
      {style.backgroundColor && (
        <Path
          path={ringBackgroundPath(center.x, center.y, outerR, innerR)}
          style="fill"
          fillType="evenOdd"
          color={resolveColorValue(style.backgroundColor, theme)}
        />
      )}
      {style.outerBoundaryLineWidth > 0 && (
        <Path
          path={circlePath(center.x, center.y, outerR)}
          style="stroke"
          strokeWidth={style.outerBoundaryLineWidth}
          color={boundaryColor}
        />
      )}
      {style.innerBoundaryLineWidth > 0 && (
        <Path
          path={circlePath(center.x, center.y, innerR)}
          style="stroke"
          strokeWidth={style.innerBoundaryLineWidth}
          color={boundaryColor}
        />
      )}

      {houseCusps.map((cuspDegree, index) => {
        const signIndex = ((Math.floor(cuspDegree / 30) % 12) + 12) % 12;
        const sign = ZODIAC_SIGNS[signIndex];
        // Swift `guard let sign = ZodiacSign(rawValue:) else { return }` — an
        // unmapped sign just skips that cusp's annotation.
        if (!sign) return null;

        const annotationCenter = coordinates.pointForDegree(cuspDegree, midR);
        const canvasAngle = coordinates.zodiacToCanvasAngle(cuspDegree);
        const angleRad = (canvasAngle * Math.PI) / 180;
        // Tangent direction (clockwise perpendicular to the radius).
        const tangent: Point = { x: Math.sin(angleRad), y: -Math.cos(angleRad) };

        const textOffset = style.glyphSize / 2 + style.glyphTextSpacing;
        const upper = isInUpperRegion(canvasAngle);
        const degreesDirection = upper ? 1 : -1;
        const minutesDirection = upper ? -1 : 1;

        const degreesPosition: Point = {
          x: annotationCenter.x + textOffset * degreesDirection * tangent.x,
          y: annotationCenter.y + textOffset * degreesDirection * tangent.y,
        };
        const minutesPosition: Point = {
          x: annotationCenter.x + textOffset * minutesDirection * tangent.x,
          y: annotationCenter.y + textOffset * minutesDirection * tangent.y,
        };

        const glyphColor = style.glyphColor
          ? resolveColorValue(style.glyphColor, theme)
          : resolveColorValue(
              { source: "hue", value: colors.zodiacColors.zodiacHues.signs[signIndex] ?? "red", layer: "ic" },
              theme,
            );

        return (
          <React.Fragment key={`cusp-annotation-${index}`}>
            <Glyph
              name={`signs/${sign}` as GlyphName}
              size={style.glyphSize}
              color={glyphColor}
              x={annotationCenter.x}
              y={annotationCenter.y}
            />
            <CenteredText
              text={`${String(degreesInSign(cuspDegree)).padStart(2, "0")}°`}
              center={degreesPosition}
              font={degreesFont}
              color={textColor}
            />
            <CenteredText
              text={`${String(minutesInSign(cuspDegree)).padStart(2, "0")}'`}
              center={minutesPosition}
              font={minutesFont}
              color={textColor}
            />
          </React.Fragment>
        );
      })}
    </Group>
  );
}
