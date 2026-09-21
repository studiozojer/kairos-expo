import { useState } from 'react';
import { ActivityIndicator, ScrollView, Text } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useTheme } from '@/theme';
import { Action, LinkRow, Note, Section } from '@/features/chart/display/controls';
import { useActiveCharts } from '@/features/chart/active/ActiveChartsContext';
import { ReplacementChooser } from '@/features/chart/active/ReplacementChooser';
import { chartDateLabel } from '@/features/chart/active/wallTime';

export default function SavedChartsScreen() {
  const state = useActiveCharts();
  const router = useRouter();
  const t = useTheme();
  const [pending, setPending] = useState<string | 'now' | null>(null);
  const open = (id: string, replaceId?: string) => {
    const opened = id === 'now' ? state.addNow(replaceId) : state.openSaved(id, replaceId);
    if (opened) { setPending(null); router.dismissTo('/(tabs)/(chart)'); } else setPending(id);
  };
  return <><Stack.Screen options={{ title: 'Saved charts' }} />
    <ScrollView style={{ flex: 1, backgroundColor: t.color.bgSolidBase }} contentContainerStyle={{ padding: t.space.lg, paddingBottom: 48 }}>
      {state.loadError ? <><Note>Couldn’t load charts stored on this device.</Note><Action label="Retry loading" onPress={state.retryLoad} /></> : !state.loaded ? <ActivityIndicator accessibilityLabel="Loading charts" /> : <>
        <Action label="Create a chart" onPress={() => router.push('/chart-editor')} />
        <Action label="Open a Now chart" onPress={() => open('now')} />
        <Note>{state.active.length} of 3 wheel slots in use. Open charts are independent copies; stepping never changes a saved original.</Note>
        {state.saveError && <><Text accessibilityRole="alert" style={{ color: t.color.txAccent }}>Changes haven’t been saved on this device.</Text><Action label="Retry saving" onPress={state.retryPersistence} /></>}
        <Section title="Created on this device">
          {!state.saved.length && <Note>No saved charts yet. Create one with a name, birth date and location.</Note>}
          {state.saved.map(chart => <Section key={chart.id} title={chart.name}>
            <LinkRow label={`Open ${chart.name}`} detail={`${chartDateLabel(Date.parse(chart.datetime), chart.settings.location.timezone)} · ${chart.settings.location.name}`}
              onPress={() => open(chart.id)} />
            <Action label={`Edit ${chart.name}`} onPress={() => router.push({ pathname: '/chart-editor', params: { id: chart.id } })} />
          </Section>)}
        </Section>
      </>}
    </ScrollView>
    <ReplacementChooser active={state.active} visible={pending !== null} onCancel={() => setPending(null)} onSelect={id => { if (pending) open(pending, id); }} />
  </>;
}
