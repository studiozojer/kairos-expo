import { ScrollView, Text, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/theme';
import { Action, Note } from '../display/controls';
import { useActiveCharts } from './ActiveChartsContext';
import { chartDateLabel } from './wallTime';

export function ActiveChartCards() {
  const state = useActiveCharts();
  const router = useRouter();
  const t = useTheme();
  return <View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: t.space.md, gap: t.space.sm }}>
      {state.active.map((chart, index) => <View key={chart.id} style={{ width: 272, padding: t.space.md, borderRadius: t.radius.md,
        borderWidth: 1, borderColor: chart.id === state.targetId ? t.color.txAccent : t.color.bdSecondary, backgroundColor: t.color.bgSolidCardSecondary }}>
        <Pressable accessibilityRole="radio" accessibilityLabel={`Step ${chart.name}, ring ${index + 1}`}
          accessibilityState={{ checked: chart.id === state.targetId }} onPress={() => state.selectTarget(chart.id)} style={{ minHeight: 44 }}>
          <Text style={[t.type.whyteSm, { color: t.color.txPrimary }]}>{chart.name}</Text>
          <Text style={[t.type.whyteXxs, { color: t.color.txAccent }]}>{index === 0 ? 'Inner ring' : `Ring ${index + 1}`} · {chart.id === state.targetId ? 'Stepper target ✓' : 'Tap to step this chart'}</Text>
        </Pressable>
        <Text style={[t.type.whyteXxs, { color: t.color.txSecondary }]}>{chartDateLabel(chart.time, chart.settings.location.timezone)}</Text>
        <Text style={[t.type.whyteXxs, { color: t.color.txTertiary }]}>{chart.settings.location.name} · {chart.settings.houseSystem}</Text>
        {state.calculations[chart.id]?.status === 'loading' && <Note>Calculating requested time…</Note>}
        {state.calculations[chart.id]?.result && (Date.parse(state.calculations[chart.id].result!.datetime) !== chart.time ||
          JSON.stringify(state.calculations[chart.id].result!.settings) !== JSON.stringify(chart.settings)) &&
          <Note>Previous calculation: {chartDateLabel(Date.parse(state.calculations[chart.id].result!.datetime), state.calculations[chart.id].result!.settings.location.timezone)} · {state.calculations[chart.id].result!.settings.location.name} · {state.calculations[chart.id].result!.settings.houseSystem}</Note>}
        {state.calculations[chart.id]?.status === 'error' && <Action label="Calculation failed · Retry" onPress={state.calculations[chart.id].retry} />}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {index > 0 && <Action label="Move inward" onPress={() => state.move(chart.id, -1)} />}
          {index < state.active.length - 1 && <Action label="Move outward" onPress={() => state.move(chart.id, 1)} />}
          {chart.id === state.targetId && <Action label={chart.kind === 'now' ? 'Reset to now' : 'Reset time'} onPress={state.reset} />}
          <Action label="Remove" onPress={() => state.remove(chart.id)} />
        </View>
      </View>)}
    </ScrollView>
    {!state.active.length && <Note>No charts open. Add a saved chart or a Now chart.</Note>}
    <Action label="Add / saved charts" onPress={() => router.push('/charts')} />
  </View>;
}
