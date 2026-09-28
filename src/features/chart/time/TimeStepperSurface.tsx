import type { ReactNode } from 'react';
import { Platform, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { useTheme } from '@/theme';

/** Match Swift's ultraThinMaterial rounded rectangle, not Liquid Glass. */
export function TimeStepperSurface({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <View style={{ borderRadius: 32, shadowColor: '#000', shadowOpacity: .05, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } }}>
    {Platform.OS === 'ios' ? <BlurView tint={t.scheme === 'dark' ? 'systemUltraThinMaterialDark' : 'systemUltraThinMaterialLight'} intensity={100}
      style={{ borderRadius: 32, overflow: 'hidden' }}>{children}</BlurView>
      : <View style={{ borderRadius: 32, backgroundColor: t.color.bgSolidBase, borderWidth: t.border.hairline, borderColor: t.color.bdSecondary }}>{children}</View>}
  </View>;
}
