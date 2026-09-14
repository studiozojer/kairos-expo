import type { ReactNode } from 'react';
import { Modal, Platform, Pressable, Text, View } from 'react-native';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';
import { Action } from '../display/controls';

const CLOSE = Skia.Path.MakeFromSVGString('M5 5L15 15M15 5L5 15')!;

/** UIKit owns the sheet presentation and swipe dismissal. */
export function ChartSheet({ visible, onClose, children }: {
  visible: boolean; onClose: () => void; children: ReactNode;
}) {
  return <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" allowSwipeDismissal onRequestClose={onClose}>
    <GestureHandlerRootView style={{ flex: 1 }}><SafeAreaProvider>{children}</SafeAreaProvider></GestureHandlerRootView>
  </Modal>;
}

/** Content header for RN Modal's page sheet, which has no navigation bar or
 * grabber API. The top grabber is visual only: UIKit still owns dismissal.
 * Equal side slots keep the title centered regardless of the trailing control. */
export function SheetHeader({ title, closeLabel, onClose, trailing }: {
  title: string; closeLabel: string; onClose: () => void; trailing?: ReactNode;
}) {
  const t = useTheme();
  return <View style={{ paddingBottom: t.space.sm }}>
    {Platform.OS === 'ios' && <View pointerEvents="none" accessible={false}
      style={{ height: t.space.xl, alignItems: 'center', paddingTop: t.space.sm }}>
      <View style={{ width: 36, height: 5, borderRadius: t.radius.full, backgroundColor: t.color.txTertiary, opacity: .5 }} />
    </View>}
    <View style={{ minHeight: 52, flexDirection: 'row', alignItems: 'center', paddingHorizontal: t.space.lg, gap: t.space.sm }}>
      <View style={{ flex: 1, minWidth: 0, alignItems: 'flex-start' }}>
        <Pressable accessibilityRole="button" accessibilityLabel={closeLabel} onPress={onClose}
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
          {({ pressed }) => <View style={{ width: 36, height: 36, borderRadius: t.radius.full,
            alignItems: 'center', justifyContent: 'center', backgroundColor: t.color.bgSolidCardSecondary, opacity: pressed ? .65 : 1 }}>
            <Canvas pointerEvents="none" style={{ width: 20, height: 20 }}><Path path={CLOSE} color={t.color.txSecondary} style="stroke" strokeWidth={1.5} strokeCap="round" /></Canvas>
          </View>}
        </Pressable>
      </View>
      <Text accessibilityRole="header" numberOfLines={1} style={[t.type.whyteMd, { color: t.color.txPrimary, textAlign: 'center', maxWidth: '40%' }]}>{title}</Text>
      <View style={{ flex: 1, minWidth: 0, alignItems: 'flex-end' }}>
        {trailing}
      </View>
    </View>
  </View>;
}

export function SheetBackRow({ title, onBack }: { title: string; onBack: () => void }) {
  const t = useTheme();
  return <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12 }}>
    <Action label="‹ Back" onPress={onBack} />
    <Text style={[t.type.whyteSm, { color: t.color.txPrimary, flex: 1 }]}>{title}</Text>
  </View>;
}
