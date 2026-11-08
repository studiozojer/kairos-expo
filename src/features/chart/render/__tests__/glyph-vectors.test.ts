import { Skia } from '@shopify/react-native-skia';
import { GLYPH_ASSETS } from '../glyph-map.gen';
import { GLYPH_VECTORS } from '../glyph-vectors.gen';

test('every shipped glyph has nonempty vector geometry accepted by Skia', () => {
  expect(Object.keys(GLYPH_VECTORS).sort()).toEqual(Object.keys(GLYPH_ASSETS).sort());
  for (const [name, glyph] of Object.entries(GLYPH_VECTORS)) {
    expect(glyph.width).toBeGreaterThan(0);
    expect(glyph.height).toBeGreaterThan(0);
    expect(glyph.parts.length).toBeGreaterThan(0);
    for (const part of glyph.parts) {
      const path = Skia.Path.MakeFromSVGString(part.d);
      if (!path) throw new Error(`Invalid path in ${name}`);
      const bounds = path.computeTightBounds();
      expect([bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite)).toBe(true);
      expect(part.opacity).toBeGreaterThan(0);
      if (part.style === 'stroke') expect(part.strokeWidth).toBeGreaterThan(0);
    }
  }
});
