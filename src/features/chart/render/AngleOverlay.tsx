import React from 'react';
import { Group, Path, Rect, Skia, Text } from '@shopify/react-native-skia';
import { families, fontMap } from '@/theme/fonts.gen';
import { useRenderFont } from './assets';
import { useChartPaintTheme } from './colors';
import { textWidth } from './textWidth';
import { ANGLE_NAMES } from '../schema/angle-overlay';
import type { ChartRenderingConfiguration } from '../config/ChartRenderingConfiguration';
import { degreesInSign, minutesInSign } from '../config/engine-types';
import type { WheelLayout } from './useWheelLayout';

export function AngleOverlay({ config, layout }: { config: ChartRenderingConfiguration; layout: WheelLayout }) {
  const theme = useChartPaintTheme();
  const scale = layout.displayScale;
  const font = useRenderFont(fontMap[families.fraktion.book], 9 * scale);
  if (!config.angleOverlay?.enabled || !font) return null;
  const { geometry, coordinates } = layout;
  const zodiacIndex = layout.rings.findIndex(r => r.type.kind === 'zodiacSigns');
  return <Group>{config.angleFrames?.flatMap(frame => {
    const ringIndex = layout.rings.findIndex(r => r.type.kind === 'planets' && r.type.ringNumber === frame.ringNumber);
    if (ringIndex < 0) return [];
    const outer = geometry.radiusForRing(ringIndex), inner = geometry.innerRadiusForRing(ringIndex);
    return frame.placements.map(angle => {
      if (!Number.isFinite(angle.longitude)) return null;
      const mode = config.angleOverlay!.labels;
      const radius = mode === 'outside' ? geometry.radiusForRing(0) + 22 * scale
        : mode === 'zodiac' && zodiacIndex >= 0 ? geometry.midRadiusForRing(zodiacIndex) : inner + 12 * scale;
      const center = coordinates.pointForDegree(angle.longitude, radius);
      const value = `${degreesInSign(angle.longitude)}°${String(minutesInSign(angle.longitude)).padStart(2, '0')}'`;
      const title = `${ANGLE_NAMES[angle.bodyId]} ${value}`;
      const subtitle = angle.signPlacement.toUpperCase();
      const width = Math.max(textWidth(font, title), textWidth(font, subtitle)) + 6 * scale;
      const height = 24 * scale;
      const path = Skia.PathBuilder.Make();
      const from = coordinates.pointForDegree(angle.longitude, inner), to = coordinates.pointForDegree(angle.longitude, outer);
      path.moveTo(from.x, from.y); path.lineTo(to.x, to.y);
      return <Group key={`${frame.ringNumber}-${angle.id}`}>
        <Path path={path.build()} color={theme.color.txPrimary} style="stroke" strokeWidth={2 * scale} />
        <Rect x={center.x - width / 2} y={center.y - height / 2} width={width} height={height} color={theme.color.bgSolidBase} />
        <Text text={title} font={font} x={center.x - textWidth(font, title) / 2} y={center.y - 2 * scale} color={theme.color.txPrimary} />
        <Text text={subtitle} font={font} x={center.x - textWidth(font, subtitle) / 2} y={center.y + 9 * scale} color={theme.color.txSecondary} />
      </Group>;
    });
  })}</Group>;
}
