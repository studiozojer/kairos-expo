import React, { useEffect, useState } from 'react';
import { Asset } from 'expo-asset';
import { Group, Path, Skia, fitbox, rect, type SkPath } from '@shopify/react-native-skia';
import { GLYPH_ASSETS, type GlyphName } from './glyph-map.gen';
import type { GlyphProps } from './Glyph';

type VectorGlyph = { width: number; height: number; paths: { path: SkPath; opacity: number }[] };
const cache = new Map<GlyphName, Promise<VectorGlyph>>();

/** CanvasKit's drawSvg rasterizes the source at its intrinsic 20×20 size.
 * These four path-only angle assets can be drawn directly as Skia vectors,
 * preserving their original outlines at every display density and zoom. */
function loadVector(name: GlyphName): Promise<VectorGlyph> {
  let pending = cache.get(name);
  if (!pending) {
    pending = (async () => {
      const response = await fetch(Asset.fromModule(GLYPH_ASSETS[name]).uri);
      if (!response.ok) throw new Error(`Could not load ${name}`);
      const doc = new DOMParser().parseFromString(await response.text(), 'image/svg+xml');
      const root = doc.documentElement;
      if (root.tagName !== 'svg' || [...root.children].some(child => child.tagName !== 'path' || child.hasAttribute('transform'))) {
        throw new Error(`Angle glyph ${name} is no longer a path-only SVG`);
      }
      const paths = [...root.children].map(child => {
        const path = Skia.Path.MakeFromSVGString(child.getAttribute('d') ?? '');
        if (!path) throw new Error(`Invalid path in ${name}`);
        return { path, opacity: Number(child.getAttribute('fill-opacity') ?? 1) };
      });
      const width = Number(root.getAttribute('width')), height = Number(root.getAttribute('height'));
      if (!(width > 0 && height > 0) || root.getAttribute('viewBox') !== `0 0 ${width} ${height}`) throw new Error(`Unsupported angle viewport: ${name}`);
      return { width, height, paths };
    })();
    cache.set(name, pending);
    pending.catch(() => cache.delete(name));
  }
  return pending;
}

export function AngleGlyph({ name, size, color, x, y, opacity = 1 }: GlyphProps) {
  const [glyph, setGlyph] = useState<VectorGlyph | null>(null);
  useEffect(() => {
    let live = true;
    setGlyph(null);
    void loadVector(name).then(value => { if (live) setGlyph(value); }).catch(error => console.error(error));
    return () => { live = false; };
  }, [name]);
  if (!glyph) return null;
  return <Group transform={fitbox('contain', rect(0, 0, glyph.width, glyph.height), rect(x - size / 2, y - size / 2, size, size))}>
    {glyph.paths.map((part, index) => <Path key={index} path={part.path} color={color} opacity={opacity * part.opacity} style="fill" />)}
  </Group>;
}
