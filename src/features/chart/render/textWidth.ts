import type { SkFont } from '@shopify/react-native-skia';
import { Platform } from 'react-native';

/** CanvasKit's SkFont.measureText is unimplemented. Native keeps ink bounds;
 * web centers the short numeric labels using the supported glyph advances. */
export function textWidth(font: SkFont, text: string): number {
  if (Platform.OS !== 'web') return font.measureText(text).width;
  return font.getGlyphWidths(font.getGlyphIDs(text)).reduce((sum, width) => sum + width, 0);
}
