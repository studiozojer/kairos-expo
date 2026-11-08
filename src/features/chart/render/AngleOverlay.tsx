import React, { useMemo } from 'react';
import { Group, Path, Rect, Skia, Text } from '@shopify/react-native-skia';
import { families, fontMap } from '@/theme/fonts.gen';
import { useRenderFont } from './assets';
import { useChartPaintTheme } from './colors';
import { textWidth } from './textWidth';
import { ANGLE_NAMES } from '../schema/angle-overlay';
import { layoutAngleLabels, type LabelBox } from '../geometry/angleLabels';
import type { ChartRenderingConfiguration } from '../config/ChartRenderingConfiguration';
import { degreesInSign, minutesInSign } from '../config/engine-types';
import type { WheelLayout } from './useWheelLayout';

export function AngleOverlay({ config, layout }: { config: ChartRenderingConfiguration; layout: WheelLayout }) {
  const theme = useChartPaintTheme();
  const scale = layout.displayScale;
  const font = useRenderFont(fontMap[families.fraktion.book], 9 * scale);
  const labels = useMemo(() => {
    if (!config.angleOverlay?.enabled || !font) return [];
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
        const title = `${ANGLE_NAMES[angle.bodyId]} ${degreesInSign(angle.longitude)}°${String(minutesInSign(angle.longitude)).padStart(2, '0')}'`;
        const subtitle = angle.signPlacement.toUpperCase();
        return { id: `${frame.ringNumber}-${angle.id}`, longitude: angle.longitude, radius, title, subtitle, inner, outer,
          width: Math.max(textWidth(font, title), textWidth(font, subtitle)) + 6 * scale, height: 24 * scale };
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
  }, [config.angleOverlay, config.angleFrames, layout, font, scale]);
  if (!font || !config.angleOverlay?.enabled) return null;
  return <Group>{labels.map(label => {
    const { coordinates } = layout;
    const path = Skia.PathBuilder.Make();
    const from = coordinates.pointForDegree(label.longitude, label.inner), to = coordinates.pointForDegree(label.longitude, label.outer);
    path.moveTo(from.x, from.y); path.lineTo(to.x, to.y);
    const leader = Skia.PathBuilder.Make();
    const anchor = coordinates.pointForDegree(label.longitude, config.angleOverlay!.labels === 'outside' ? label.outer : label.inner);
    leader.moveTo(anchor.x, anchor.y); leader.lineTo(label.center.x, label.center.y);
    return <Group key={label.id}>
      <Path path={path.build()} color={theme.color.txPrimary} style="stroke" strokeWidth={2 * scale} />
      <Path path={leader.build()} color={theme.color.txSecondary} style="stroke" strokeWidth={0.6 * scale} />
      <Rect {...label.box} color={theme.color.bgSolidBase} />
      <Text text={label.title} font={font} x={label.center.x - textWidth(font, label.title) / 2} y={label.center.y - 2 * scale} color={theme.color.txPrimary} />
      <Text text={label.subtitle} font={font} x={label.center.x - textWidth(font, label.subtitle) / 2} y={label.center.y + 9 * scale} color={theme.color.txSecondary} />
    </Group>;
  })}</Group>;
}
