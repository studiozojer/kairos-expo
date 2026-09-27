import { Text, View } from 'react-native';
import { useTheme } from '@/theme';
import type { ChartActions } from '../actions/useActionRegistry';
import { markingActions, type ActionSlots } from '../actions/markingActions';
import { MarkingMenuButton } from '../marking/MarkingMenu';
import { MarkingIcon } from '../marking/MarkingIcon';

const SLOTS = { s: 'chart.addNow' } as const satisfies ActionSlots;
export function AddChartButton({ actions, expanded }: { actions: ChartActions; expanded: boolean }) {
  const t = useTheme();
  const action = actions.describe('chart.library');
  const icon = <MarkingIcon name="add" color={t.color.txSecondary} />;
  return <View style={{ flex: expanded ? 1 : undefined, borderRadius: 6, backgroundColor: t.color.bgSolidCardSecondary }}>
    <MarkingMenuButton id="add-chart" label={action.label} hint={action.hint} disabled={!action.enabled}
      onPress={() => actions.invoke('chart.library')} options={markingActions(SLOTS, actions, t.color.txAccent)}
      menuContent={icon} style={expanded ? { width: '100%' } : undefined}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.space.sm }}>
        {icon}{expanded && <Text style={[t.type.whyteMd, { color: t.color.txSecondary }]}>Add chart to view</Text>}
      </View>
    </MarkingMenuButton>
  </View>;
}
