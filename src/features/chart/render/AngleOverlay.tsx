import React, { useMemo } from 'react';
import { Group, Path, Skia } from '@shopify/react-native-skia';
import { useChartPaintTheme } from './colors';
import { AngleGlyph } from './AngleGlyph';
import type { GlyphName } from './glyph-map.gen';
import { fixedAngleMarkers } from '../geometry/fixedAngles';
import type { ChartRenderingConfiguration } from '../config/ChartRenderingConfiguration';
import type { WheelLayout } from './useWheelLayout';

export function AngleOverlay({ config, layout }: { config: ChartRenderingConfiguration; layout: WheelLayout }) {
  const theme = useChartPaintTheme();
  const scale = layout.displayScale;
  const labels = useMemo(() => fixedAngleMarkers(config, layout), [config, layout]);
  if (!config.angleOverlay?.enabled) return null;
  return <Group>{labels.map(label => {
    const { coordinates } = layout;
    const path = Skia.PathBuilder.Make();
    const from = coordinates.pointForDegree(label.longitude, label.inner + (config.angleOverlay!.labels === 'inner' ? 23 * scale : 0)), to = coordinates.pointForDegree(label.longitude, label.outer);
    path.moveTo(from.x, from.y); path.lineTo(to.x, to.y);
    return <Group key={label.id}>
      <Path path={path.build()} color={theme.color.icDisabled} style="stroke" strokeWidth={2 * scale} />
      <AngleGlyph name={label.glyph} size={18 * scale} x={label.center.x} y={label.center.y} color={theme.color.txPrimary} />
    </Group>;
  })}</Group>;
}
