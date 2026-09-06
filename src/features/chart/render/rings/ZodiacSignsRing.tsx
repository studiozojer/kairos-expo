/**
 * ZodiacSignsRing — the 12-segment zodiac band. Port of kairos-ios
 * `Features/ChartWheel/Viewing/Wheel/Rings/ZodiacSignsRing.swift`.
 *
 * Pass order preserved (each pass draws over the previous):
 *   1. segment fills + trimmed outer/inner arc strokes (per segment)
 *   2. cusp border lines (per segment edge, offset inward so adjacent
 *      segments' half-width lines sit side by side)
 *   3. radial lines at the 12 sign boundaries (one style for all)
 *   4. sign glyphs at segment midpoints (+ optional degree markers)
 *
 * ANGLE CONVENTION (self-consistent; do not "fix" piecemeal): every position
 * comes from ChartCoordinateSystem. `zodiacToCanvasAngle` DECREASES as the
 * zodiac degree increases (zodiac grows counter-clockwise), so a segment
 * [s, s+30] spans canvas angles [a0−30, a0] where a0 = canvas(s). Skia arcs
 * (addArc: 0° at 3 o'clock, positive sweep clockwise in y-down space —
 * skia/types/Path/Path.d.ts) therefore sweep −30. SwiftUI's
 * `addArc(..., clockwise:)` flag semantics differ from Skia's start/sweep
 * form; what is ported is the covered REGION, which the glyphs' own
 * placements (same transform) verify.
 *
 * STROKE-WIDTH ZERO DIVERGENCE: SwiftUI `lineWidth: 0` strokes are invisible;
 * Skia `strokeWidth: 0` is a HAIRLINE (always 1px). Every stroke here is
 * gated `width > 0` before drawing.
 *
 * iOS machinery deliberately not ported in this shell: SignNode/selection
 * (SelectionStyleComputer), the hit-radius node list, and the emoji glyph
 * fallback (text is Task 9).
 */

import React, { useMemo } from "react";

import { Group, Path, Skia } from "@shopify/react-native-skia";
import type { SkPath } from "@shopify/react-native-skia";

import { ZODIAC_SIGNS } from "../../schema/enums.gen";
import { ZODIAC_RING_STYLE_DEFAULT, ZODIAC_STYLE_TYPE } from "../../schema/ring-styles";
import type { ZodiacRingStyle } from "../../schema/ring-styles";
import { Glyph } from "../Glyph";
import type { GlyphName } from "../glyph-map.gen";
import { resolveColorValue, signColorValues, useChartPaintTheme } from "../colors";
import type { RingRendererProps } from "../ChartWheel";

const DEG = Math.PI / 180;
const SEGMENT_DEGREES = 30;

/** Point at a CANVAS angle (already through zodiacToCanvasAngle) + radius. */
function polar(cx: number, cy: number, canvasAngleDeg: number, radius: number) {
  const rad = canvasAngleDeg * DEG;
  return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
}

/**
 * Annular sector covering zodiac degrees [startDeg, endDeg]: outer arc, line
 * to the inner radius, inner arc back, close. The explicit moveTo/lineTo make
 * the radial edges deterministic rather than relying on addArc's implicit
 * line-to-arc-start.
 *
 * Paths are built with Skia.PathBuilder — the imperative SkPath mutation
 * methods (moveTo/addArc/…) are deprecated since Skia 2.x's PathBuilder
 * migration (they still work but warn).
 */
export function segmentPath(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  a0: number,
  a1: number,
): SkPath {
  const builder = Skia.PathBuilder.Make();
  const outerStart = polar(cx, cy, a0, outerR);
  const innerEnd = polar(cx, cy, a1, innerR);
  builder.moveTo(outerStart.x, outerStart.y);
  // arcToOval(..., forceMoveTo: false) continues the CURRENT contour — unlike
  // addArc, which always opens a new one (SkPathBuilder::arcTo(oval, start,
  // sweep, forceMoveTo: TRUE)). Both arcs must extend this same subpath so
  // the fill is one continuous contour (outer arc -> line to inner -> inner
  // arc reversed -> close), matching Swift's `Path.addArc` behavior.
  builder.arcToOval(
    Skia.XYWHRect(cx - outerR, cy - outerR, 2 * outerR, 2 * outerR),
    a0,
    a1 - a0,
    false,
  );
  builder.lineTo(innerEnd.x, innerEnd.y);
  builder.arcToOval(
    Skia.XYWHRect(cx - innerR, cy - innerR, 2 * innerR, 2 * innerR),
    a1,
    a0 - a1,
    false,
  );
  builder.close();
  return builder.build();
}

/** A bare arc (canvas angles), for the trimmed segment border strokes. */
function arcPath(cx: number, cy: number, radius: number, fromDeg: number, toDeg: number): SkPath {
  const builder = Skia.PathBuilder.Make();
  builder.addArc(
    Skia.XYWHRect(cx - radius, cy - radius, 2 * radius, 2 * radius),
    fromDeg,
    toDeg - fromDeg,
  );
  return builder.build();
}

/** A single straight segment (cusp border lines). */
function linePath(x1: number, y1: number, x2: number, y2: number): SkPath {
  const builder = Skia.PathBuilder.Make();
  builder.moveTo(x1, y1);
  builder.lineTo(x2, y2);
  return builder.build();
}

export function ZodiacSignsRing({ ring, ringIndex, layout, colors }: RingRendererProps) {
  const theme = useChartPaintTheme();
  // buildConfiguration pairs a zodiac ring with its ZodiacRingStyle; if a
  // hand-built config says otherwise, iOS's render-variant dispatch would do
  // the equivalent of falling back to defaults — do that.
  const style: ZodiacRingStyle =
    ring.style.$type === ZODIAC_STYLE_TYPE ? ring.style : ZODIAC_RING_STYLE_DEFAULT;

  const { geometry, coordinates } = layout;
  const outerR = geometry.radiusForRing(ringIndex);
  const innerR = geometry.innerRadiusForRing(ringIndex);
  const midR = geometry.midRadiusForRing(ringIndex);
  const { x: cx, y: cy } = coordinates.center;

  const paths = useMemo(() => {
    const fills: { key: string; path: SkPath; color: string }[] = [];
    const borders: { key: string; path: SkPath; width: number; color: string }[] = [];
    const radialLines = Skia.PathBuilder.Make();
    const majorMarks = Skia.PathBuilder.Make();
    const minorMarks = Skia.PathBuilder.Make();

    const borderWidth = style.segmentBorderWidth;
    const halfBorder = borderWidth / 2;
    const cuspBorderWidth = borderWidth / 2; // each segment contributes half at a cusp
    // Angular trims (Swift computes them in radians at the OUTER radius for
    // both arcs — ChartGeometry parity, not a typo).
    const trimDeg = outerR > 0 ? cuspBorderWidth / outerR / DEG : 0;
    const offsetDeg = outerR > 0 ? cuspBorderWidth / 2 / outerR / DEG : 0;

    for (let signIndex = 0; signIndex < 12; signIndex++) {
      const startDeg = signIndex * SEGMENT_DEGREES;
      const endDeg = startDeg + SEGMENT_DEGREES;
      const a0 = coordinates.zodiacToCanvasAngle(startDeg);
      const a1 = coordinates.zodiacToCanvasAngle(endDeg);
      const signColors = signColorValues(colors, signIndex);

      // Pass 1: fill + trimmed arc strokes.
      const fillColor = resolveColorValue(style.backgroundColor ?? signColors.background, theme);
      fills.push({
        key: `seg-${signIndex}`,
        path: segmentPath(cx, cy, outerR, innerR, a0, a1),
        color: fillColor,
      });

      if (borderWidth > 0) {
        const borderColor = resolveColorValue(
          style.segmentBorderColor ?? signColors.border,
          theme,
        );
        borders.push({
          key: `outer-${signIndex}`,
          path: arcPath(cx, cy, outerR - halfBorder, a0 - trimDeg, a1 + trimDeg),
          width: borderWidth,
          color: borderColor,
        });
        borders.push({
          key: `inner-${signIndex}`,
          path: arcPath(cx, cy, innerR + halfBorder, a0 - trimDeg, a1 + trimDeg),
          width: borderWidth,
          color: borderColor,
        });

        // Pass 2: cusp border lines, offset INTO the segment at both edges.
        for (const [edge, angleDeg] of [
          ["start", a0 - offsetDeg],
          ["end", a1 + offsetDeg],
        ] as const) {
          const outer = polar(cx, cy, angleDeg, outerR - halfBorder);
          const inner = polar(cx, cy, angleDeg, innerR + halfBorder);
          borders.push({
            key: `cusp-${edge}-${signIndex}`,
            path: linePath(outer.x, outer.y, inner.x, inner.y),
            width: cuspBorderWidth,
            color: borderColor,
          });
        }
      }

      // Pass 3: radial boundary line (accumulated; one stroke for all 12).
      if (style.radialLineWidth > 0) {
        const outer = coordinates.pointForDegree(startDeg, outerR);
        const inner = coordinates.pointForDegree(startDeg, innerR);
        radialLines.moveTo(outer.x, outer.y);
        radialLines.lineTo(inner.x, inner.y);
      }

      // Pass 4 (markers): degree ticks from the inner edge outward; zodiac
      // cusps (every 30°) skipped. iOS colors these `bd/primary` regardless of
      // ring style (ZodiacSignsRing.swift:427).
      if (style.showDegreeMarkers) {
        for (let d = startDeg; d < endDeg; d += style.minorMarkInterval) {
          if (d % SEGMENT_DEGREES === 0) continue;
          const isMajor = d % style.majorMarkInterval === 0;
          const length = isMajor ? style.majorMarkLength : style.minorMarkLength;
          const inner = coordinates.pointForDegree(d, innerR);
          const outer = coordinates.pointForDegree(d, innerR + length);
          const marks = isMajor ? majorMarks : minorMarks;
          marks.moveTo(inner.x, inner.y);
          marks.lineTo(outer.x, outer.y);
        }
      }
    }

    return {
      fills,
      borders,
      radialLines: radialLines.build(),
      majorMarks: majorMarks.build(),
      minorMarks: minorMarks.build(),
    };
  }, [style, colors, theme, coordinates, geometry, outerR, innerR, cx, cy]);

  const radialColor = resolveColorValue(
    style.radialLineColor ?? { source: "semantic", value: "secondary", layer: "bd" },
    theme,
  );

  return (
    <Group>
      {/* Pass 1 — segment fills */}
      {paths.fills.map((s) => (
        <Path key={s.key} path={s.path} style="fill" color={s.color} />
      ))}
      {/* Pass 1b + 2 — trimmed arc strokes, then cusp border lines */}
      {paths.borders.map((b) => (
        <Path key={b.key} path={b.path} style="stroke" strokeWidth={b.width} color={b.color} />
      ))}
      {/* Pass 3 — radial boundary lines */}
      {style.radialLineWidth > 0 && (
        <Path
          path={paths.radialLines}
          style="stroke"
          strokeWidth={style.radialLineWidth}
          color={radialColor}
        />
      )}
      {/* Pass 4 — degree markers (opt-in via style.showDegreeMarkers) */}
      {style.showDegreeMarkers && (
        <>
          <Path
            path={paths.majorMarks}
            style="stroke"
            strokeWidth={style.majorMarkWidth}
            color={theme.color.bdPrimary}
          />
          <Path
            path={paths.minorMarks}
            style="stroke"
            strokeWidth={style.minorMarkWidth}
            color={theme.color.bdPrimary}
          />
        </>
      )}
      {/* Pass 4 — sign glyphs at segment midpoints */}
      {ZODIAC_SIGNS.map((sign, signIndex) => {
        const glyphDeg = signIndex * SEGMENT_DEGREES + SEGMENT_DEGREES / 2;
        const pos = coordinates.pointForDegree(glyphDeg, midR);
        const glyphColor = resolveColorValue(
          style.glyphColor ?? signColorValues(colors, signIndex).icon,
          theme,
        );
        const glyph = (
          <Glyph
            name={`signs/${sign}` as GlyphName}
            size={style.glyphSize}
            color={glyphColor}
            x={pos.x}
            y={pos.y}
          />
        );
        // iOS: rotate around the glyph center by the canvas angle of
        // (degree − 90) when rotateGlyphs is set (classic preset: true).
        if (!style.rotateGlyphs) return <React.Fragment key={sign}>{glyph}</React.Fragment>;
        return (
          <Group
            key={sign}
            origin={pos}
            transform={[{ rotate: coordinates.zodiacToCanvasAngle(glyphDeg - 90) * DEG }]}>
            {glyph}
          </Group>
        );
      })}
    </Group>
  );
}
