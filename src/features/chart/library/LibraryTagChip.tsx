import { Pressable, Text, View } from 'react-native';
import { useTheme } from '@/theme';

/** Swift TagSize.xs geometry, with Whyte labels and a full-height touch target. */
export function LibraryTagChip({ label, accessibilityLabel, selected, accessory, onPress }: {
  label: string;
  accessibilityLabel: string;
  selected?: boolean;
  accessory?: '+' | '×';
  onPress: () => void;
}) {
  const t = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel}
    accessibilityState={selected === undefined ? undefined : { selected }} onPress={onPress}
    style={({ pressed }) => ({ minHeight: 44, justifyContent: 'center', paddingVertical: 4, opacity: pressed ? .65 : 1 })}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8,
      borderRadius: 8, borderWidth: 1, borderColor: selected ? t.color.bdPrimary : t.color.bdSecondary,
      backgroundColor: selected ? t.color.bgPressed : t.color.bgSecondary }}>
      <Text style={[t.type.whyteXs, { fontSize: 14, color: selected ? t.color.txPrimary : t.color.txTertiary, flexShrink: 1 }]}>{label}</Text>
      {accessory && <Text accessible={false} style={[t.type.whyteXs, { color: t.color.icTertiary }]}>{accessory}</Text>}
    </View>
  </Pressable>;
}
