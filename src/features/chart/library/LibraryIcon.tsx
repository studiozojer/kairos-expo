import { Canvas, Path, Skia } from '@shopify/react-native-skia';

const paths = {
  search: 'M16 16L21 21 M18 10A8 8 0 1 1 2 10A8 8 0 1 1 18 10',
  plus: 'M12 4V20 M4 12H20',
  close: 'M6 6L18 18 M18 6L6 18',
  sort: 'M7 3V21 M3 7L7 3L11 7 M17 3V21 M13 17L17 21L21 17',
  more: 'M4 12h.1 M12 12h.1 M20 12h.1',
  star: 'M12 2L15 8.5L22 9.5L17 14.5L18.2 22L12 18.5L5.8 22L7 14.5L2 9.5L9 8.5Z',
  clock: 'M22 12A10 10 0 1 1 2 12A10 10 0 1 1 22 12 M12 6V12L16 14',
};
const shapes = Object.fromEntries(Object.entries(paths).map(([key, path]) => [key, Skia.Path.MakeFromSVGString(path)!]));
export function LibraryIcon({ name, color }: { name: keyof typeof paths; color: string }) {
  return <Canvas pointerEvents="none" accessible={false} style={{ width: 24, height: 24 }}>
    <Path path={shapes[name]} color={color} style={name === 'star' ? 'fill' : 'stroke'} strokeWidth={name === 'more' ? 3 : 1.5} strokeCap="round" strokeJoin="round" />
  </Canvas>;
}
