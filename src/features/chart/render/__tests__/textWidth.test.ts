import type { SkFont } from '@shopify/react-native-skia';
import { Platform } from 'react-native';
import { textWidth } from '../textWidth';

it('measures browser labels without calling the unimplemented measureText API', () => {
  const original = Platform.OS;
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
  try {
    const font = {
      measureText: jest.fn(() => { throw new Error('Not implemented on React Native Web'); }),
      getGlyphIDs: jest.fn(() => [1, 2]), getGlyphWidths: jest.fn(() => [5.5, 6.25]),
    };
    expect(textWidth(font as unknown as SkFont, '12')).toBe(11.75);
    expect(font.measureText).not.toHaveBeenCalled();
    expect(font.getGlyphIDs).toHaveBeenCalledWith('12');
  } finally { Object.defineProperty(Platform, 'OS', { configurable: true, value: original }); }
});
