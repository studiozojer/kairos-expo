import { StarText as Text } from './StarText';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Pressable, View } from 'react-native';
import { useTheme } from '@/theme';
const symbols = {
  search: { ios: 'magnifyingglass', android: 'search', web: 'search' },
  close: { ios: 'xmark', android: 'close', web: 'close' },
  info: { ios: 'info.circle', android: 'info', web: 'info' },
  back: { ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' },
  down: { ios: 'chevron.down', android: 'expand_more', web: 'expand_more' },
  check: { ios: 'checkmark', android: 'check', web: 'check' },
} as const satisfies Record<string, SymbolViewProps['name']>;
/** Native control symbols avoid tiny Skia surfaces disappearing during keyboard/layout changes. */
export function StarIcon({ name, color, size = 20 }: { name: keyof typeof symbols; color: string; size?: number }) {
  return <SymbolView name={symbols[name]} tintColor={color} size={size} pointerEvents="none" accessible={false} style={{ width: size, height: size }} />;
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
