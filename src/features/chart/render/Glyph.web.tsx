import React, { useMemo } from 'react';
import { Group, Path, Skia, fitbox, rect, type SkPath } from '@shopify/react-native-skia';
import type { GlyphProps } from './Glyph';
import type { GlyphName } from './glyph-map.gen';
import { GLYPH_VECTORS } from './glyph-vectors.gen';
import { makeGlyphPaint } from './glyphPaint';

const paths = new Map<GlyphName, SkPath[]>();

function pathsFor(name: GlyphName): SkPath[] {
  let cached = paths.get(name);
  if (!cached) {
    cached = GLYPH_VECTORS[name].parts.map(part => {
      const path = Skia.Path.MakeFromSVGString(part.d);
      if (!path) throw new Error(`Invalid generated glyph path: ${name}`);
      return path;
    });
    paths.set(name, cached);
  }
  return cached;
}

/** Web-only: draw vector geometry directly, bypassing ImageSVG's intrinsic-size
 * bitmap conversion. CanvasKit rasterizes these paths at the canvas's device
 * resolution, including the current scale and rotation. Native keeps Glyph.tsx. */
export const Glyph = React.memo(function Glyph({ name, size, color, x, y, selected = false, opacity = 1 }: GlyphProps) {
  const glyph = GLYPH_VECTORS[name];
  const geometry = pathsFor(name);
  const paint = useMemo(() => makeGlyphPaint(color, opacity, selected), [color, opacity, selected]);
  const destination = rect(x - size / 2, y - size / 2, size, size);
  const padding = selected ? 7 : 1;
  return <Group clip={rect(destination.x - padding, destination.y - padding, size + padding * 2, size + padding * 2)}>
    <Group transform={fitbox('contain', rect(0, 0, glyph.width, glyph.height), destination)} layer={paint}>
      <Group clip={rect(0, 0, glyph.width, glyph.height)}>
        {glyph.parts.map((part, index) => <Path key={index} path={geometry[index]} color="black"
          style={part.style} opacity={part.opacity} strokeWidth={part.strokeWidth}
          strokeCap={part.strokeCap} strokeJoin={part.strokeJoin} />)}
      </Group>
    </Group>
  </Group>;
});
