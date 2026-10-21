import { createContext, useContext, useMemo } from 'react';
import { Skia, useFont, type SkSVG, type SkTypeface } from '@shopify/react-native-skia';
import type { GlyphName } from './glyph-map.gen';

export interface LoadedGlyph { svg: SkSVG; width: number; height: number }
export interface RenderAssets { glyphs: Map<GlyphName, LoadedGlyph>; typefaces: Map<number, SkTypeface> }
export const RenderAssetsContext = createContext<RenderAssets | null>(null);

/** Exports preload resources before the offscreen reconciler runs. Live views
 * continue using Skia's asynchronous hooks with no asset-provider dependency. */
export function useRenderFont(...args: Parameters<typeof useFont>) {
  const [source, size, onError] = args;
  const assets = useContext(RenderAssetsContext);
  const loaded = useFont(assets ? null : source, size, onError);
  const typeface = assets?.typefaces.get(source as number);
  return useMemo(() => {
    if (!assets) return loaded;
    if (!typeface) throw new Error('A chart font was not loaded for export.');
    return Skia.Font(typeface, size);
  }, [assets, loaded, typeface, size]);
}
