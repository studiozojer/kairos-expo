import { BlendMode, Skia } from '@shopify/react-native-skia';

/** Use a native paint object, not a JSX Paint declaration. Skia 2.6.2's
 * native standalone SavePaint pushes two states and restores only one,
 * leaking inherited opacity into subsequent chart elements. SVG drawing
 * also ignores inherited paint, so its layer must receive opacity directly. */
export function makeGlyphPaint(color: string, opacity: number, selected: boolean) {
  const paint = Skia.Paint();
  paint.setColorFilter(Skia.ColorFilter.MakeBlend(Skia.Color(color), BlendMode.SrcIn));
  paint.setAlphaf(opacity);
  if (selected) paint.setImageFilter(Skia.ImageFilter.MakeDropShadow(0, 1, 2, 2, Skia.Color('rgba(0,0,0,0.1)'), null));
  return paint;
}
