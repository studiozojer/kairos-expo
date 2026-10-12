import { StarText as Text } from './StarText';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme';
const paths = {
  search: 'M14 14L20 20M16 9A7 7 0 1 1 2 9A7 7 0 1 1 16 9',
  close: 'M6 6L18 18M18 6L6 18',
  info: 'M12 11V17M12 7V7.2M22 12A10 10 0 1 1 2 12A10 10 0 1 1 22 12',
  back: 'M14 5L7 12L14 19',
  down: 'M6 9L12 15L18 9',
  check: 'M6 12L10 16L18 8',
};
export function StarIcon({ name, color, size = 20 }: { name: keyof typeof paths; color: string; size?: number }) {
  return <Canvas pointerEvents="none" style={{ width: size, height: size }}>
    <Path path={Skia.Path.MakeFromSVGString(paths[name])!} transform={[{ scale: size / 24 }]} color={color} style="stroke" strokeWidth={1.5} strokeCap="round" strokeJoin="round" />
  </Canvas>;
}
export function LibraryHeader({ title = 'Personal star library', onBack, onClose }: { title?: string; onBack?: () => void; onClose?: () => void }) {
  const t = useTheme();
  return <View style={{ paddingHorizontal: t.space.lg, paddingVertical: t.space.sm, flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
    {onBack && <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} style={{ minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' }}><StarIcon name="back" color={t.color.txPrimary} /></Pressable>}
    <Text accessibilityRole="header" style={[t.type.whyteMd, { flex: 1, color: t.color.txPrimary }]}>{title}</Text>
    {onClose && <Pressable accessibilityRole="button" accessibilityLabel="Close star library" onPress={onClose} style={{ minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' }}><StarIcon name="close" color={t.color.txSecondary} /></Pressable>}
  </View>;
}
/** Feature action uses readable foreground and the canonical card pressed role. */
export function StarAction({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  const t = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 12, paddingVertical: 10, marginVertical: 6, justifyContent: 'center', borderRadius: t.radius.md, borderWidth: t.border.thin, borderColor: t.color.bdCard, backgroundColor: pressed ? t.color.bgSolidCardPressed : t.color.bgSolidCardSecondary, opacity: disabled ? .5 : 1 })}><Text style={[t.type.whyteSm, { color: t.color.txPrimary }]}>{label}</Text></Pressable>;
}
