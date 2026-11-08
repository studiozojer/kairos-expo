import React, { useMemo } from 'react';
import { Group, Path, Skia, Text } from '@shopify/react-native-skia';
import { resolveColorValue, useChartPaintTheme } from './colors';
import { AngleGlyph } from './AngleGlyph';
import { families, fontMap } from '@/theme/fonts.gen';
import { useRenderFont } from './assets';
import { textWidth } from './textWidth';
import { fixedAngleMarkers } from '../geometry/fixedAngles';
import type { ChartRenderingConfiguration } from '../config/ChartRenderingConfiguration';
import type { WheelLayout } from './useWheelLayout';

export function AngleOverlay({ config, layout }: { config: ChartRenderingConfiguration; layout: WheelLayout }) {
  const theme = useChartPaintTheme();
  const scale = layout.displayScale;
  const labels = useMemo(() => fixedAngleMarkers(config, layout), [config, layout]);
  if (!config.angleOverlay?.enabled) return null;
  return <Group>{labels.map(label => {
    const path = Skia.PathBuilder.Make();
    const from = label.strokeStart, to = label.strokeEnd;
    path.moveTo(from.x, from.y); path.lineTo(to.x, to.y);
    return <Group key={label.id}>
      <Path path={path.build()} color={theme.color.icDisabled} style="stroke" strokeWidth={2 * scale} />
      {label.annotations.map((annotation, index) => <AngleAnnotation key={index} {...annotation} color={label.textColor ? resolveColorValue(label.textColor, theme) : theme.color.icPrimary} />)}
      <AngleGlyph name={label.glyph} size={18 * scale} x={label.center.x} y={label.center.y} color={theme.color.txPrimary} />
    </Group>;
  })}</Group>;
}

function AngleAnnotation({ text, size, center, color }: { text: string; size: number; center: { x: number; y: number }; color: string }) {
  const font = useRenderFont(fontMap[families.fraktion.book], size);
  if (!font) return null;
  const { ascent, descent } = font.getMetrics();
  return <Text text={text} font={font} x={center.x - textWidth(font, text) / 2} y={center.y - (ascent + descent) / 2} color={color} />;
}
