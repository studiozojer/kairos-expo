/**
 * HouseNumbersRing — cusp lines + house numbers at wraparound-aware
 * midpoints. Port of kairos-ios
 * `.../Viewing/Wheel/Rings/HouseNumbersRing.swift`.
 *
 * ALL POSITION MATH beyond the plain trig every ring does inline (same
 * precedent as ZodiacSignsRing/PlanetsRing — `coordinates`/`geometry` calls
 * directly in the component) lives in `ChartCoordinateSystem` (Task 5):
 * `calculateMidpoint` handles the 350°→10° wraparound case.
 *
 * SELECTION: not ported (ZodiacSignsRing/PlanetsRing precedent) — every cusp
 * line and house number draws at full opacity, no highlighting. Swift's own
 * "cusp lines always render" comment (Stage 3.5 D8 dropped
 * `HousesRingStyle.showCuspLines`) means there's no enable/disable knob to
 * carry over either.
 *
 * NAME FIDELITY: `toRomanNumeral` is a Swift MISNOMER, preserved verbatim
 * for grep parity — despite the name, `HouseNumbersRing.swift`'s switch just
 * stringifies 1-12 ("1", "2", … "12"); it never emits actual roman numerals.
 * Ported as-is, not "fixed" (the brief quotes this exact call site).
 *
 * DEAD KNOBS (faithful-but-odd, same convention documented in PlanetsRing.tsx):
 *  - `numberFontWeight` is decoded but never read by the render path — the
 *    font is always the fixed PPFraktionMono-Regular family.
 *  - `thickAngularLines` is decoded but the cusp-line-width switch never
 *    consults it (angular cusps always use `angularCuspLineWidth`,
 *    non-angular always `cuspLineWidth`, regardless of this flag).
 *
 * STROKE-WIDTH ZERO DIVERGENCE (ZodiacSignsRing precedent): SwiftUI
 * `lineWidth: 0` is invisible; Skia `strokeWidth: 0` is a hairline. Every
 * stroke here is gated `width > 0` before drawing, even though Swift's own
 * cusp-line draw has no such gate (its defaults are never 0).
 */

import { selectionOpacity } from "../../interaction/selection";
import React from "react";

import { Group, Path, Skia, Text, useFont, type SkFont, type SkPath } from "@shopify/react-native-skia";

import { families, fontMap } from "@/theme/fonts.gen";
import type { Theme } from "@/theme";

import type { Point } from "../../geometry/types";
import { HOUSES_RING_STYLE_DEFAULT, HOUSES_STYLE_TYPE, type HousesRingStyle } from "../../schema/ring-styles";
import type { RingRendererProps } from "../ChartWheel";
import { resolveColorValue, useChartPaintTheme } from "../colors";

const ANGULAR_HOUSES = new Set([1, 4, 7, 10]);

function linePath(from: Point, to: Point): SkPath {
  const builder = Skia.PathBuilder.Make();
  builder.moveTo(from.x, from.y);
  builder.lineTo(to.x, to.y);
  return builder.build();
}

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

/**
 * Swift `toRomanNumeral` — despite the name, this is decimal 1-12 (see the
 * module header's NAME FIDELITY note). `n` is always 1-12 in practice
 * (`houseCusps` is always 12 entries); the fallback mirrors Swift's
 * unreachable `default: "\(number)"` arm.
 */
export function toRomanNumeral(houseNumber: number): string {
  return String(houseNumber);
}

export function isAngularHouse(houseNumber: number): boolean {
  return ANGULAR_HOUSES.has(houseNumber);
}

/**
 * Cusp line color: angular cusps prefer `angularCuspLineColor`, falling back
 * to `cuspLineColor`, falling back to `bd/primary`; non-angular cusps skip
 * straight to `cuspLineColor` ?? `bd/primary`. (Swift
 * `drawCuspLineWithAppearance`'s color inheritance.)
 */
export function cuspLineColor(isAngular: boolean, style: HousesRingStyle, theme: Theme): string {
  if (isAngular && style.angularCuspLineColor) return resolveColorValue(style.angularCuspLineColor, theme);
  if (style.cuspLineColor) return resolveColorValue(style.cuspLineColor, theme);
  return theme.color.bdPrimary;
}

/** Boundary-stroke color: `style.boundaryLineColor ?? bd/primary`. */
export function boundaryLineColor(style: HousesRingStyle, theme: Theme): string {
  if (style.boundaryLineColor) return resolveColorValue(style.boundaryLineColor, theme);
  return theme.color.bdPrimary;
}

/** Centered text origin via font metrics (PlanetsRing precedent — Skia's
 *  Text x/y is baseline-left; Swift's `.center` anchor centers both axes). */
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

export function HouseNumbersRing({ ring, ringIndex, layout, selection }: RingRendererProps) {
  const theme = useChartPaintTheme();
  const style: HousesRingStyle =
    ring.style.$type === HOUSES_STYLE_TYPE ? ring.style : HOUSES_RING_STYLE_DEFAULT;

  const fraktion = fontMap[families.fraktion.book];
  const font = useFont(fraktion, style.numberFontSize);

  const { geometry, coordinates, houseCusps } = layout;
  const outerR = geometry.radiusForRing(ringIndex);
  const innerR = geometry.innerRadiusForRing(ringIndex);
  const midR = geometry.midRadiusForRing(ringIndex);
  const center = coordinates.center;
  const numberColor = theme.color.txTertiary; // Swift default: Color.tx(.tertiary) (no selection)

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

      {houseCusps.map((cuspDegree, index) => {
        const houseNumber = index + 1;
        const angular = isAngularHouse(houseNumber);
        const lineWidth = angular ? style.angularCuspLineWidth : style.cuspLineWidth;

        const nextCuspDegree = houseCusps[(index + 1) % 12];
        const midpointDegree = coordinates.calculateMidpoint(cuspDegree, nextCuspDegree);
        const numberPosition = coordinates.pointForDegree(midpointDegree, midR);
        const text = toRomanNumeral(houseNumber);
        const rotationDeg = style.rotateNumbers
          ? coordinates.zodiacToCanvasAngle(midpointDegree - 90)
          : 0;

        const numberNode = (
          <Group opacity={selectionOpacity(selection, `house:${houseNumber}`, "affectsHouseNumbers")}><CenteredText text={text} center={numberPosition} font={font} color={numberColor} /></Group>
        );

        return (
          <React.Fragment key={`house-${houseNumber}`}>
            {lineWidth > 0 && (
              <Path
                path={linePath(
                  coordinates.pointForDegree(cuspDegree, outerR),
                  coordinates.pointForDegree(cuspDegree, innerR),
                )}
                style="stroke"
                opacity={selectionOpacity(selection, `house:${houseNumber}`, "affectsCuspLines")}
                strokeWidth={lineWidth}
                color={cuspLineColor(angular, style, theme)}
              />
            )}
            {style.rotateNumbers ? (
              <Group origin={numberPosition} transform={[{ rotate: (rotationDeg * Math.PI) / 180 }]}>
                {numberNode}
              </Group>
            ) : (
              numberNode
            )}
          </React.Fragment>
        );
      })}

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
