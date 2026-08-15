/**
 * Glyph — one chart glyph (zodiac sign, celestial body, rx, …) as a tinted
 * Skia SVG.
 *
 * Resolution: `name` keys GLYPH_ASSETS in glyph-map.gen.ts (generated from
 * kairos-ios's asset catalog; never hand-edit). The SVG loads through Skia's
 * own `useSVG(require(asset))` — Skia parses the SVG itself; react-native-svg
 * is NOT involved.
 *
 * Tint: iOS renders these as template images — the catalog imagesets carry
 * `"template-rendering-intent": "template"` — then floods the glyph's alpha
 * mask with the paint color via a sourceAtop fill (SVGRenderer.swift:23-55).
 * The Skia equivalent: draw the SVG on a layer whose Paint carries a
 * BlendColor srcIn filter — the tint survives only where the glyph has alpha,
 * and the SVG's own per-stroke opacities (the assets use stroke-opacity 0.9)
 * are preserved.
 *
 * Sizing: the glyph SVGs declare absolute root dimensions (20×20 viewBox —
 * one outlier, kairos-logo, is 775×811), and ImageSVG ignores width/height
 * when the root viewport is absolute (docs: images-svg#scaling-the-svg) — so
 * scale is applied explicitly with `fitbox("contain", …)` from the SVG's
 * intrinsic size into the size×size box centered at (x, y).
 *
 * Memoized (default shallow compare = by name/size/color/x/y). In jest,
 * Skia's mock returns null from useSVG — Glyph renders null there.
 *
 * LOAD-FAILURE HARDENING (fix round 1, 2026-08-15): a Metro asset URL that
 * reaches the native fetch mangled (observed for space-containing filenames
 * — since fixed at the source in sync-chart-glyphs.mjs, which now slugifies
 * copied filenames while keeping the iOS-name KEY) can produce a `useSVG`
 * result that is NON-null but wraps a null native SkSVG. `useSVG`'s own
 * `onError` only fires when the native factory returns a strict JS `null`
 * (react-native-skia's `factoryWrapper`); this wrapped-null-pointer case
 * slips past that check, so `!svg` alone is not a sufficient guard — calling
 * `.width()`/`.height()` on it dereferences the null pointer natively and
 * crashes (SIGSEGV, unrecoverable — no JS `try`/`catch` survives an actual
 * native segfault; this guard cannot promise otherwise). Two layers, best
 * effort: `onError` catches genuine fetch/parse rejections outright; probing
 * `.width()`/`.height()` inside a `useEffect` (never during render — calling
 * `.width()` inline and only then discovering it throws would already be the
 * crash) catches the subset of native failures that DO surface as a
 * catchable JSI error, and latches `broken` so a bad `svg` is never touched
 * a second time. Combined with the source-of-truth asset-path fix, the
 * originally observed crash is eliminated; this is defense for the next
 * broken glyph reference.
 */

import React, { useEffect, useState } from "react";

import { BlendColor, Group, ImageSVG, Paint, fitbox, rect, useSVG } from "@shopify/react-native-skia";

import { GLYPH_ASSETS, type GlyphName } from "./glyph-map.gen";

export interface GlyphProps {
  /** Key into GLYPH_ASSETS — "<group>/<name>", e.g. "signs/aries". */
  name: GlyphName;
  /** Square box side, in points (already display-scaled by the caller). */
  size: number;
  /** Resolved hex color (#RRGGBBAA) — resolve ColorValues via colors.ts. */
  color: string;
  /** Center x/y in canvas coordinates. */
  x: number;
  y: number;
}

export const Glyph = React.memo(function Glyph({ name, size, color, x, y }: GlyphProps) {
  const [broken, setBroken] = useState(false);
  const svg = useSVG(GLYPH_ASSETS[name], () => setBroken(true));
  const [dims, setDims] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    if (!svg) {
      setDims(null);
      return;
    }
    try {
      setDims({ width: svg.width(), height: svg.height() });
    } catch (err) {
      console.warn(`Glyph: SVG "${name}" failed to read after load; rendering nothing.`, err);
      setBroken(true);
      setDims(null);
    }
  }, [svg, name]);

  // Not-yet-loaded (async asset read), the jest mock (useSVG returns null
  // there), a reported load error, or dimensions not yet validated. iOS
  // draws an emoji fallback here (SVGRenderer fallbackText); text rendering
  // is Task 9, so the shell draws nothing until the SVG is ready.
  if (!svg || broken || !dims) return null;

  const src = rect(0, 0, dims.width, dims.height);
  const dst = rect(x - size / 2, y - size / 2, size, size);

  return (
    <Group
      transform={fitbox("contain", src, dst)}
      layer={
        <Paint>
          <BlendColor color={color} mode="srcIn" />
        </Paint>
      }>
      <ImageSVG svg={svg} x={0} y={0} width={dims.width} height={dims.height} />
    </Group>
  );
});
