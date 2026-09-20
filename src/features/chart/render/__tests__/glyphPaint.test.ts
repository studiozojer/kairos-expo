import { AlphaType, ColorType, ClipOp, Skia } from '@shopify/react-native-skia';
import { makeGlyphPaint } from '../glyphPaint';

// Rasterize with real CanvasKit. The opaque rectangle stands in for an SVG's
// self-painted content (SVG does not consume the surrounding drawing paint).
// This checks composited pixels, rather than just opacity props on React nodes.
test('glyph layer applies 20% once and does not dim later drawing', () => {
  const surface = Skia.Surface.MakeOffscreen(160, 20)!;
  const canvas = surface.getCanvas();
  canvas.clear(Skia.Color('transparent'));
  const ink = Skia.Paint();
  ink.setColor(Skia.Color('#ffffff'));
  for (let i = 0; i < 24; i++) {
    const bounds = Skia.XYWHRect(i * 5, 0, 4, 10);
    const tint = makeGlyphPaint('#ff0000', .2, false);
    canvas.save();
    canvas.clipRect(bounds, ClipOp.Intersect, false);
    canvas.saveLayer(tint);
    canvas.drawRect(bounds, ink);
    canvas.restore();
    canvas.restore();
    tint.dispose();
  }
  const selected = makeGlyphPaint('#ff0000', 1, false);
  canvas.saveLayer(selected);
  canvas.drawRect(Skia.XYWHRect(120, 0, 4, 10), ink);
  canvas.restore();
  // A later annotation/cusp/aspect uses its own alpha, unaffected by glyphs.
  ink.setAlphaf(.7);
  canvas.drawRect(Skia.XYWHRect(130, 0, 4, 10), ink);
  surface.flush();
  const image = surface.makeImageSnapshot();
  const pixels = image.readPixels(0, 0, { width: 160, height: 20, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul })!;
  const alpha = (x: number) => pixels[(5 * 160 + x) * 4 + 3];
  for (let i = 0; i < 24; i++) expect(alpha(i * 5 + 2)).toBeCloseTo(51, 0);
  expect(alpha(122)).toBe(255);
  expect(alpha(132)).toBeGreaterThanOrEqual(178);
  expect(alpha(132)).toBeLessThanOrEqual(179);
  expect(pixels[(5 * 160 + 2) * 4]).toBe(255);
  expect(pixels[(5 * 160 + 2) * 4 + 1]).toBe(0);
  selected.dispose(); ink.dispose(); image.dispose(); surface.dispose();
});
