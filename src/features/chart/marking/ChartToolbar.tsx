import { Text, View } from 'react-native';
import { useTheme } from '@/theme';
import { MarkingMenuButton } from './MarkingMenu';
import { MarkingIcon } from './MarkingIcon';
import type { MarkingIconName } from './iconNames';

export function ChartToolbar({ title, topInset, locked, settingsEnabled, chartEnabled, capturing, onSettings, onLock, onScreenshot, onDisplay }: {
  title: string; topInset: number; locked: boolean; settingsEnabled: boolean; chartEnabled: boolean; capturing: boolean;
  onSettings: () => void; onLock: () => void; onScreenshot: () => void; onDisplay: () => void;
}) {
  const t = useTheme();
  const button = (id: string, icon: MarkingIconName, label: string, hint: string, onPress: () => void, disabled = false) =>
    <MarkingMenuButton id={id} label={label} hint={hint} onPress={onPress} disabled={disabled}><MarkingIcon name={icon} color={t.color.txAccent} /></MarkingMenuButton>;
  return <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: topInset + 8, paddingBottom: 8, borderBottomWidth: 1, borderColor: t.color.bdSecondary, backgroundColor: t.color.bgSolidBase }}>
    {button('settings', 'settings', 'Chart settings', 'Opens calculation settings for the selected chart.', onSettings, !settingsEnabled)}
    <Text numberOfLines={1} style={[t.type.whyteSm, { color: t.color.txPrimary, flex: 1, marginHorizontal: 8 }]}>{title}</Text>
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {button('lock', locked ? 'lock' : 'unlock', locked ? 'Unlock chart' : 'Lock chart', 'Switches between fixed and Ascendant orientation.', onLock, !chartEnabled)}
      {button('screenshot', 'screenshot', capturing ? 'Capturing chart' : 'Screenshot', 'Captures this chart page for sharing.', onScreenshot, !chartEnabled || capturing)}
      {button('display', 'display', 'Display settings', 'Opens chart display options.', onDisplay, !chartEnabled)}
    </View>
  </View>;
}
