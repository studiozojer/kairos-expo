import { Platform, Pressable, Text, View } from 'react-native';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { useTheme } from '@/theme';

const CLOSE = Skia.Path.MakeFromSVGString('M5 5L15 15M15 5L5 15')!;
const CHEVRON = Skia.Path.MakeFromSVGString('M5 8L10 13L15 8')!;

function HeaderIcon({ name, color }: { name: 'close' | 'chevron'; color: string }) {
  return <Canvas pointerEvents="none" style={{ width: 20, height: 20 }}>
    <Path path={name === 'close' ? CLOSE : CHEVRON} color={color} style="stroke" strokeWidth={1.5} strokeCap="round" strokeJoin="round" />
  </Canvas>;
}

/** A named preset control, separate from the sheet's navigation actions. */
export function PresetSelector({ name, onPress }: { name: string; onPress: () => void }) {
  const t = useTheme();
  const label = name.charAt(0).toUpperCase() + name.slice(1);
  return <Pressable accessibilityRole="button" accessibilityLabel={`Display preset: ${label}`}
    accessibilityHint="Choose a display preset" onPress={onPress}
    style={{ minHeight: 44, minWidth: 44, maxWidth: '100%', justifyContent: 'center' }}>
    {({ pressed }) => <View style={{
      minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: t.space.xs,
      paddingStart: t.space.md, paddingEnd: t.space.sm,
      borderRadius: t.radius.full, borderWidth: t.border.thin, borderColor: t.color.bdCard,
      backgroundColor: t.color.bgSolidCardSecondary, opacity: pressed ? .65 : 1,
    }}>
      <Text numberOfLines={1} style={[t.type.whyteXs, { color: t.color.txPrimary, flexShrink: 1 }]}>{label}</Text>
      <HeaderIcon name="chevron" color={t.color.txSecondary} />
    </View>}
  </Pressable>;
}

/** Content header for RN Modal's page sheet, which has no navigation bar or
 * grabber API. The top grabber is visual only: UIKit still owns dismissal.
 * Equal side slots keep the title centered regardless of the preset name. */
export function DisplayHeader({ presetName, onClose, onChoosePreset }: {
  presetName: string; onClose: () => void; onChoosePreset: () => void;
}) {
  const t = useTheme();
  return <View style={{ paddingBottom: t.space.sm }}>
    {Platform.OS === 'ios' && <View pointerEvents="none" accessible={false}
      style={{ height: t.space.xl, alignItems: 'center', paddingTop: t.space.sm }}>
      <View style={{ width: 36, height: 5, borderRadius: t.radius.full, backgroundColor: t.color.txTertiary, opacity: .5 }} />
    </View>}
    <View style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: t.space.lg, gap: t.space.sm }}>
      <View style={{ flex: 1, minWidth: 0, alignItems: 'flex-start' }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close display settings" onPress={onClose}
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          {({ pressed }) => <View style={{ width: 36, height: 36, borderRadius: t.radius.full,
            alignItems: 'center', justifyContent: 'center', backgroundColor: t.color.bgSolidCardSecondary, opacity: pressed ? .65 : 1 }}>
            <HeaderIcon name="close" color={t.color.txSecondary} />
          </View>}
        </Pressable>
      </View>
      <Text accessibilityRole="header" numberOfLines={1} style={[t.type.whyteMd, { color: t.color.txPrimary, textAlign: 'center', maxWidth: '40%' }]}>Display</Text>
      <View style={{ flex: 1, minWidth: 0, alignItems: 'flex-end' }}>
        <PresetSelector name={presetName} onPress={onChoosePreset} />
      </View>
    </View>
  </View>;
}
