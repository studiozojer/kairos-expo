import { Text, View } from 'react-native';
import { useTheme } from '@/theme';
import { MarkingMenuButton } from './MarkingMenu';
import { MarkingIcon } from './MarkingIcon';
import type { ActionId } from '../actions/actionRegistry';
import { markingActions, type ActionSlots } from '../actions/markingActions';
import type { ChartActions } from '../actions/useActionRegistry';

type ToolbarButton = 'settings' | 'lock' | 'screenshot' | 'display';
export function ChartToolbar({ title, topInset, actions, slots }: {
  title: string; topInset: number; actions: ChartActions; slots?: Partial<Record<ToolbarButton, ActionSlots>>;
}) {
  const t = useTheme();
  const button = (id: ToolbarButton, actionId: ActionId) => {
    const action = actions.describe(actionId);
    return <MarkingMenuButton id={id} label={action.label} hint={action.hint}
      onPress={() => actions.invoke(actionId)} disabled={!action.enabled}
      options={slots?.[id] ? markingActions(slots[id], actions, t.color.txAccent) : undefined}>
      <MarkingIcon name={action.icon} color={t.color.txAccent} />
    </MarkingMenuButton>;
  };
  return <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: topInset + 8, paddingBottom: 8, borderBottomWidth: 1, borderColor: t.color.bdSecondary, backgroundColor: t.color.bgSolidBase }}>
    {button('settings', 'chart.settings')}
    <Text numberOfLines={1} style={[t.type.whyteSm, { color: t.color.txPrimary, flex: 1, marginHorizontal: 8 }]}>{title}</Text>
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {button('lock', 'orientation.toggle')}
      {button('screenshot', 'chart.screenshot')}
      {button('display', 'display.settings')}
    </View>
  </View>;
}
