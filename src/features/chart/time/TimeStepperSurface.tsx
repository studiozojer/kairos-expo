import type { ReactNode } from 'react';
import { Platform, View } from 'react-native';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useTheme } from '@/theme';

/** Native glass material without the native tab accessory's elastic press shell.
 * isInteractive controls the material response, not child touch handling. */
export function TimeStepperSurface({ children }: { children: ReactNode }) {
  const theme = useTheme();
  if (Platform.OS === 'ios' && isGlassEffectAPIAvailable() && isLiquidGlassAvailable()) {
    return <GlassView glassEffectStyle="regular" isInteractive={false} colorScheme={theme.scheme}
      style={{ borderRadius: theme.radius.full }}>
      {children}
    </GlassView>;
  }
  return <View style={{ borderRadius: theme.radius.full, backgroundColor: theme.color.bgSolidBase,
    borderWidth: theme.border.hairline, borderColor: theme.color.txTertiary }}>
    {children}
  </View>;
}
