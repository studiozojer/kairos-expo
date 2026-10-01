import { Pressable, Text, View } from 'react-native';
import { useTheme } from '@/theme';

/** Mirrors Swift FilterChip / FilterChipState; distinct from editor TagChip. */
export function LibraryFilterChip({ label, selected, active, onPress }: {
  label: string; selected: boolean; active: boolean; onPress: () => void;
}) {
  const t = useTheme();
  // daoUI bg/disabled is the same neutral as bg/primary at 4% opacity.
  const disabledBackground = `${t.color.bgPrimary.slice(0, 7)}0a`;
  return <Pressable accessibilityRole="button" accessibilityLabel={`Filter: ${label}`}
    accessibilityState={{ selected }} onPress={onPress}
    style={{ minHeight: 44, justifyContent: 'center' }}>
    {({ pressed }) => <View style={{ minHeight: 36, justifyContent: 'center', paddingHorizontal: 12,
      paddingVertical: 6, borderRadius: 999, backgroundColor: pressed ? t.color.bgPressed : active ? t.color.bgPrimary : disabledBackground }}>
      <Text style={[t.type.whyteSm, { color: pressed || active ? t.color.txPrimary : t.color.txDisabled }]}>{label}</Text>
    </View>}
  </Pressable>;
}
