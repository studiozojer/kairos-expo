import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { useTheme } from '@/theme';
import type { PatternName } from '../geometry/AspectPatterns';
const OUTLINES: Record<PatternName, readonly (readonly [number, number])[]> = {
  'Grand Trine': [[20, 4], [36, 33], [4, 33]],
  'T-square': [[4, 22], [20, 6], [36, 22]],
  'Grand Cross': [[20, 3], [37, 20], [20, 37], [3, 20]],
  Yod: [[20, 3], [30, 35], [10, 35]],
  Kite: [[20, 3], [36, 24], [20, 37], [4, 24]],
  'Mystic Rectangle': [[5, 8], [35, 8], [35, 32], [5, 32]],
};
const PATHS = Object.fromEntries(Object.entries(OUTLINES).map(([name, points]) => {
  const path = Skia.PathBuilder.Make();
  points.forEach(([x, y], i) => { if (i === 0) path.moveTo(x, y); else path.lineTo(x, y); });
  path.close();
  return [name, path.build()];
}));
export function PatternIcon({ name }: { name: PatternName }) {
  const theme = useTheme();
  return <Canvas style={{ width: 40, height: 40 }}><Path path={PATHS[name]} color={theme.color.txAccent} style="stroke" strokeWidth={1.25} /></Canvas>;
}
