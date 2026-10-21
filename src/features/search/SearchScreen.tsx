import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Keyboard, Platform, Pressable, SectionList, Text, TextInput, View } from 'react-native';
import { useTheme } from '@/theme';
import { useActiveCharts } from '../chart/active/ActiveChartsContext';
import { ReplacementChooser } from '../chart/active/ReplacementChooser';
import { useAccountCharts } from '../chart/transfers/ArchiveContext';
import { chartSearchProvider } from './chartSource';
import type { SearchAction } from './search';
import { useGlobalSearch } from './useGlobalSearch';

export default function SearchScreen() {
  const state = useActiveCharts();
  return <SearchContent key={state.scope ?? 'anonymous'} />;
}
function SearchContent() {
  const state = useActiveCharts();
  const account = useAccountCharts();
  const t = useTheme();
  const router = useRouter();
  const [raw, setRaw] = useState('');
  const [pending, setPending] = useState<SearchAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const providers = useMemo(() => [chartSearchProvider(state.saved, state.libraryPreferences.opened)], [state.saved, state.libraryPreferences.opened]);
  const search = useGlobalSearch(raw, providers);
  const waiting = !state.loaded || search.loading || !!account?.initialLoading || !!account?.downloading;
  const sections = search.sections.map(section => ({ ...section, data: section.results }));
  const hasResults = sections.some(section => section.data.length);
  const failure = error || (state.loadError ? 'Could not load saved charts.' : state.libraryError) || account?.error;
  const open = (action: SearchAction, replaceId?: string) => {
    setError(null);
    switch (action.type) {
      case 'open-saved-chart': {
        if (!state.saved.some(chart => chart.id === action.chartId)) {
          setPending(null); setError('This chart is no longer saved.'); return;
        }
        if (state.openSaved(action.chartId, replaceId)) {
          setPending(null); Keyboard.dismiss(); router.navigate('/(tabs)/(chart)');
        } else if (state.active.length >= 3) setPending(action);
        else { setPending(null); setError('Could not open this chart. Please try again.'); }
      }
    }
  };
  const retry = async () => {
    setError(null);
    if (state.loadError) state.retryLoad();
    else try { await state.reloadLibrary(); } catch { setError('Could not reload saved charts.'); }
    await account?.refresh();
    search.retry();
  };
  const textStyle = { ...t.type.whyteSm, color: t.color.txSecondary };
  return <View style={{ flex: 1, backgroundColor: t.color.bgSolidBase }}>
    <Stack.Screen options={{ title: 'Search', headerSearchBarOptions: {
      placeholder: 'Search saved charts', hideWhenScrolling: false, autoCapitalize: 'none',
      tintColor: t.color.txAccent, onChangeText: e => setRaw(e.nativeEvent.text), onCancelButtonPress: () => setRaw(''),
    } }} />
    {/* Retain native header search without auto-focus. Web needs its own input. */}
    {Platform.OS === 'web' && <TextInput accessibilityLabel="Search" placeholder="Search saved charts" value={raw} onChangeText={setRaw}
      style={[textStyle, { padding: t.space.md }]} />}
    <SectionList sections={sections} keyExtractor={item => item.id} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
      contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ paddingBottom: t.space.xl }}
      ListHeaderComponent={<View style={{ padding: t.space.lg, gap: t.space.sm }}>
        <Text style={textStyle}>Find saved charts by name, place, or tag.</Text>
        {waiting && !state.loadError && <ActivityIndicator accessibilityLabel="Searching" />}
        {!!failure && <><Text accessibilityRole="alert" style={textStyle}>{failure}</Text>
          <Pressable accessibilityRole="button" onPress={() => void retry()} style={{ paddingVertical: t.space.md }}><Text style={textStyle}>Retry loading charts</Text></Pressable></>}
        {!waiting && !failure && !hasResults && !sections.some(section => section.failed) && <Text style={textStyle}>
          {search.query.text ? `No results for “${raw.trim()}”.` : 'No saved charts yet.'}
        </Text>}
      </View>}
      renderSectionHeader={({ section }) => <View style={{ paddingHorizontal: t.space.lg, backgroundColor: t.color.bgSolidBase }}>
        <Text accessibilityRole="header" style={{ ...t.type.fraktionXs, color: t.color.txTertiary }}>{section.title}</Text>
        {section.failed && <Pressable accessibilityRole="button" onPress={search.retry} style={{ paddingVertical: t.space.md }}>
          <Text style={textStyle}>Could not search {section.title.toLowerCase()}. Retry</Text>
        </Pressable>}
      </View>}
      renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`Open ${item.title}`} accessibilityHint={item.subtitle}
        onPress={() => open(item.action)} style={({ pressed }) => ({ padding: t.space.lg, minHeight: 56, backgroundColor: pressed ? t.color.bgPressed : 'transparent', borderBottomWidth: .5, borderBottomColor: t.color.bdSecondary })}>
        <Text style={{ ...t.type.whyteSm, color: t.color.txPrimary }}>{item.title}</Text>
        <Text style={{ ...t.type.whyteXs, color: t.color.txTertiary }}>{item.subtitle}</Text>
      </Pressable>} />
    <ReplacementChooser active={state.active} visible={pending !== null} onCancel={() => setPending(null)} onSelect={id => { if (pending) open(pending, id); }} />
  </View>;
}
