import { Canvas, Path } from '@shopify/react-native-skia';

/** Material's filled delete icon, the Android counterpart of trash.fill. */
export function PutAwayIcon({ color }: { color: string }) {
  return <Canvas style={{ width: 24, height: 24 }}>
    <Path path="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" color={color} />
  </Canvas>;
}
