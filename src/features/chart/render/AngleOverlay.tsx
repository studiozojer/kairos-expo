import React, { useMemo } from 'react';
import { Group, Path, Skia } from '@shopify/react-native-skia';
import { useChartPaintTheme } from './colors';
import { Glyph } from './Glyph';
import type { GlyphName } from './glyph-map.gen';
import { layoutAngleLabels, type LabelBox } from '../geometry/angleLabels';
import type { ChartRenderingConfiguration } from '../config/ChartRenderingConfiguration';
import type { WheelLayout } from './useWheelLayout';

export function AngleOverlay({ config, layout }: { config: ChartRenderingConfiguration; layout: WheelLayout }) {
  const theme = useChartPaintTheme();
  const scale = layout.displayScale;
  const labels = useMemo(() => {
    if (!config.angleOverlay?.enabled) return [];
    const { geometry, coordinates } = layout;
    const zodiacIndex = layout.rings.findIndex(r => r.type.kind === 'zodiacSigns');
    const entries = (config.angleFrames ?? []).flatMap(frame => {
      const ringIndex = layout.rings.findIndex(r => r.type.kind === 'planets' && r.type.ringNumber === frame.ringNumber);
      if (ringIndex < 0) return [];
      const outer = geometry.radiusForRing(ringIndex), inner = geometry.innerRadiusForRing(ringIndex);
      return frame.placements.filter(angle => Number.isFinite(angle.longitude)).map(angle => {
        const mode = config.angleOverlay!.labels;
        const radius = mode === 'outside' ? geometry.radiusForRing(0) + 12 * scale
          : mode === 'zodiac' && zodiacIndex >= 0 ? geometry.midRadiusForRing(zodiacIndex) : inner + 12 * scale;
        return { id: `${frame.ringNumber}-${angle.id}`, longitude: angle.longitude, radius, inner, outer,
          glyph: `celestials/${angle.glyphAsset}` as GlyphName,
          width: 18 * scale, height: 18 * scale };

      });
    });
    // Conservative boxes include each planet's glyph and radial degree stack.
    const obstacles: LabelBox[] = [];
    for (const positions of layout.planetLayouts.values()) for (const position of positions) {
      const a = position.adjustedPosition, b = position.farSideConnectionEndpoint;
      const pad = 10 * scale;
      obstacles.push({ x: Math.min(a.x, b.x) - pad, y: Math.min(a.y, b.y) - pad,
        width: Math.abs(a.x - b.x) + 2 * pad, height: Math.abs(a.y - b.y) + 2 * pad });
    }
    if (zodiacIndex >= 0) for (let i = 0; i < 12; i++) {
      const p = coordinates.pointForDegree(i * 30 + 15, geometry.midRadiusForRing(zodiacIndex));
      obstacles.push({ x: p.x - 9 * scale, y: p.y - 9 * scale, width: 18 * scale, height: 18 * scale });
    }
    const resolved = layoutAngleLabels(entries, (degree, radius) => coordinates.pointForDegree(degree, radius), layout.size, obstacles, 3 * scale);
    return entries.map((entry, index) => ({ ...entry, ...resolved[index] }));
  }, [config.angleOverlay, config.angleFrames, layout, scale]);
  if (!config.angleOverlay?.enabled) return null;
  return <Group>{labels.map(label => {
    const { coordinates } = layout;
    const path = Skia.PathBuilder.Make();
    const from = coordinates.pointForDegree(label.longitude, label.inner + (config.angleOverlay!.labels === 'inner' ? 23 * scale : 0)), to = coordinates.pointForDegree(label.longitude, label.outer);
    path.moveTo(from.x, from.y); path.lineTo(to.x, to.y);
    return <Group key={label.id}>
      <Path path={path.build()} color={theme.color.txPrimary} style="stroke" strokeWidth={2 * scale} />
      <Glyph name={label.glyph} size={18 * scale} x={label.center.x} y={label.center.y} color={theme.color.txPrimary} />
    </Group>;
  })}</Group>;
}
