import { View } from 'react-native';
import { useTheme } from '@/theme';
import { MarkingMenuButton } from './MarkingMenu';
import { MarkingIcon } from './MarkingIcon';
import type { ActionId } from '../actions/actionRegistry';
import { markingActions, type ActionSlots } from '../actions/markingActions';
import type { ChartActions } from '../actions/useActionRegistry';

export const LOCK_SLOTS = { sw: 'orientation.left', s: 'orientation.reset', se: 'orientation.right' } as const satisfies ActionSlots;

type ToolbarButton = 'settings' | 'lock' | 'screenshot' | 'display';
export function ChartToolbar({ topInset, actions, slots }: {
  topInset: number; actions: ChartActions; slots?: Partial<Record<ToolbarButton, ActionSlots>>;
}) {
  const t = useTheme();
  const button = (id: ToolbarButton, actionId: ActionId) => {
    const action = actions.describe(actionId);
    const assigned = slots?.[id] ?? (id === 'lock' ? LOCK_SLOTS : undefined);
    return <MarkingMenuButton id={id} label={action.label} hint={action.hint}
      onPress={() => actions.invoke(actionId)} disabled={!action.enabled}
      options={assigned ? markingActions(assigned, actions, t.color.icAccent) : undefined}>
      <MarkingIcon name={action.icon} color={t.color.icAccent} />
    </MarkingMenuButton>;
  };
  return <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: topInset + 8, paddingBottom: 8, borderBottomWidth: 1, borderColor: t.color.bdSecondary, backgroundColor: t.color.bgSolidBase }}>
    {button('settings', 'chart.settings')}
    <View style={{ flex: 1 }} />
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {button('lock', 'orientation.toggle')}
      {button('screenshot', 'chart.screenshot')}
      {button('display', 'display.settings')}
    </View>
  </View>;
}
