import { useState } from 'react';
import { Canvas, Fill, LinearGradient, vec } from '@shopify/react-native-skia';
import { ActivityIndicator, Alert, FlatList, Keyboard, Platform, Pressable, ScrollView, Text, TextInput, View, type ViewProps } from 'react-native';
import { MenuView } from '@react-native-menu/menu';
import { Stack, useRouter } from 'expo-router';
import { useTheme } from '@/theme';
import { Action, Note } from '@/features/chart/display/controls';
import { useActiveCharts } from '@/features/chart/active/ActiveChartsContext';
import type { SavedChart } from '@/features/chart/active/model';
import { ReplacementChooser } from '@/features/chart/active/ReplacementChooser';
import { LibraryFilterChip } from '@/features/chart/library/LibraryFilterChip';
import { LibraryIcon } from '@/features/chart/library/LibraryIcon';
import { LibraryRow, type LibraryRowAction } from '@/features/chart/library/LibraryRow';
import { LibrarySyncSettings } from '@/features/chart/library/LibrarySyncSettings';
import { browseCharts, libraryTags } from '@/features/chart/library/browse';
import { DEFAULT_LIBRARY_PREFERENCES, type LibrarySort } from '@/features/chart/library/preferences';

const SORTS: [LibrarySort, string][] = [['recent', 'Recently opened'], ['name-asc', 'Name (A–Z)'], ['name-desc', 'Name (Z–A)'], ['date-desc', 'Date (newest)'], ['date-asc', 'Date (oldest)']];

export default function SavedChartsScreen() {
  const state = useActiveCharts();
  // The provider remounts on account changes; browser selections never cross accounts.
  const router = useRouter();
  const t = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [syncDetails, setSyncDetails] = useState(false);
  const [pending, setPending] = useState<string | 'now' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const preferences = state.libraryPreferences ?? DEFAULT_LIBRARY_PREFERENCES;
  const tags = libraryTags(state.saved);
  // A removed/renamed tag must not strand the list behind an invisible filter.
  const selected = tagIds.filter(id => tags.some(tag => tag.id === id));
  const charts = browseCharts(state.saved, query, tags.filter(tag => selected.includes(tag.id)).flatMap(tag => tag.ids), preferences);
  const open = (id: string, replaceId?: string) => {
    if (id !== 'now' && !state.saved.some(chart => chart.id === id)) { setPending(null); setError('This chart is no longer saved.'); return; }
    const opened = id === 'now' ? state.addNow(replaceId) : state.openSaved(id, replaceId);
    if (opened) { setPending(null); Keyboard.dismiss(); router.dismissTo('/(tabs)/(chart)'); } else setPending(id);
  };
  const edit = (chart?: SavedChart, duplicate = false) => {
    Keyboard.dismiss();
    router.push({ pathname: '/chart-editor', params: { fromLibrary: '1', ...(chart ? duplicate ? { duplicate: chart.id } : { id: chart.id } : {}) } });
  };
  const favorite = async (chart: SavedChart) => {
    try { setError(null); await state.setFavorite(chart.id, !chart.metadata?.favorite); }
    catch { setError('Couldn’t change this favorite. Please try again.'); }
  };
  const action = (chart: SavedChart, choice: LibraryRowAction) => {
    if (choice === 'favorite') {
      if (chart.metadata?.favorite) Alert.alert('Remove from favorites?', chart.name, [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', onPress: () => void favorite(chart) }]);
      else void favorite(chart);
    } else if (choice === 'edit') edit(chart);
    else if (choice === 'duplicate') edit(chart, true);
    else Alert.alert(`Delete ${chart.name}?`, 'Open copies remain on the wheel as unsaved snapshots. For synced charts, deletion reaches other devices when sync next completes.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete chart', style: 'destructive', onPress: () => void state.deleteSaved(chart.id) }]);
  };
  const syncLabel = !state.scope ? 'On this device' : !state.syncState?.enabled ? 'Sync paused' : state.syncing ? 'Syncing…' : state.syncError ? 'Sync needs attention' : state.syncState.pending ? `${state.syncState.pending} waiting to sync` : state.syncState.lastSyncedAt ? 'Synced' : 'Waiting to sync';
  const menuAccessibility: Pick<ViewProps, 'accessible' | 'accessibilityRole' | 'accessibilityLabel'> = { accessible: true, accessibilityRole: 'button', accessibilityLabel: 'Sort saved charts' };
  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    setError(null);
    try { await state.reloadLibrary(); }
    catch { setError('Couldn’t reload charts. Please try again.'); }
    finally { setRefreshing(false); }
  };
  const header = <View collapsable={false} style={{ backgroundColor: t.color.bgSolidCard }}>
    <View style={{ paddingHorizontal: 16, paddingTop: 24, paddingBottom: 8, minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      {searching ? <>
        <TextInput accessibilityLabel="Search charts" placeholder="Search charts…" placeholderTextColor={t.color.txTertiary} value={query} onChangeText={setQuery}
          autoFocus autoCorrect={false} returnKeyType="search" onSubmitEditing={Keyboard.dismiss}
          style={[t.type.whyteSm, { flex: 1, minWidth: 0, minHeight: 44, color: t.color.txPrimary }]} />
        <Pressable accessibilityRole="button" accessibilityLabel="Cancel chart search" onPress={() => { setSearching(false); setQuery(''); Keyboard.dismiss(); }} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }}>
          <Text style={[t.type.whyteSm, { color: t.color.txAccent }]}>Cancel</Text>
        </Pressable>
      </> : <>
        <Text accessibilityRole="header" numberOfLines={1} style={[t.type.whyteLg, { flex: 1, color: t.color.txPrimary }]}>Saved Charts</Text>
        <IconButton name="search" label="Search charts" onPress={() => setSearching(true)} />
        <IconButton name="plus" label="Create a chart" onPress={() => edit()} />
        <IconButton name="close" label="Close saved charts" onPress={() => router.back()} />
      </>}
    </View>
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingVertical: 4, gap: 6 }}>
      <MenuView {...menuAccessibility} title="Sort charts" themeVariant={t.scheme} shouldOpenOnLongPress={false}
        actions={SORTS.map(([id, title]) => ({ id, title, state: id === preferences.sort ? 'on' : 'off' }))}
        onPressAction={({ nativeEvent: { event } }) => {
          if (SORTS.some(([id]) => id === event)) void state.setLibrarySort(event as LibrarySort).catch(() => setError('Couldn’t save the sort order. Please try again.'));
        }} style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
        <LibraryIcon name="sort" color={t.color.icSecondary} />
      </MenuView>
      <View style={{ flex: 1 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ flex: 1 }} contentContainerStyle={{ alignItems: 'center', gap: 6, paddingLeft: 12, paddingRight: 16 }}>
        <LibraryFilterChip active={!selected.length} label="All" selected={!selected.length} onPress={() => setTagIds([])} />
        {tags.map(tag => <LibraryFilterChip active={!selected.length || selected.includes(tag.id)} key={tag.id} label={tag.name} selected={selected.includes(tag.id)} onPress={() => setTagIds(selected.includes(tag.id) ? selected.filter(id => id !== tag.id) : [...selected, tag.id])} />)}
        {!tags.length && <Text style={[t.type.whyteXs, { color: t.color.txTertiary }]}>Add tags when editing a chart</Text>}
      </ScrollView>
      {(['left'] as const).map(edge => <Canvas key={edge} pointerEvents="none" accessible={false}
        style={{ position: 'absolute', top: 0, bottom: 0, width: 24, [edge]: 0 }}>
        <Fill>
          <LinearGradient start={vec(0, 0)} end={vec(24, 0)}
            colors={[t.color.bgSolidCard, `${t.color.bgSolidCard.slice(0, 7)}00`]} />
        </Fill>
      </Canvas>)}
      </View>
    </View>
    <Pressable accessibilityRole="button" accessibilityLabel={`Chart sync: ${syncLabel}`} accessibilityState={{ expanded: syncDetails }} onPress={() => setSyncDetails(!syncDetails)}
      style={{ minHeight: 44, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text style={[t.type.whyteXs, { color: state.syncError ? t.color.txError : t.color.txAccent }]}>{syncLabel} {syncDetails ? '⌃' : '⌄'}</Text>
      <Text style={[t.type.whyteXs, { color: t.color.txTertiary }]}>{charts.length} {charts.length === 1 ? 'chart' : 'charts'}</Text>
    </Pressable>
  </View>;
  const beforeRows = <>
    {syncDetails && <View style={{ paddingHorizontal: 16 }}><LibrarySyncSettings /></View>}
    {(error || state.libraryError) && <Text accessibilityRole="alert" style={[t.type.whyteSm, { padding: 16, color: t.color.txError }]}>{error ?? state.libraryError}</Text>}
    {state.syncError && !syncDetails && <View style={{ paddingHorizontal: 16 }}><Text accessibilityRole="alert" style={[t.type.whyteXs, { color: t.color.txError }]}>{state.syncError}</Text><Action label="Retry chart sync" onPress={() => void state.runSync()} /></View>}
    {state.saveError && <View style={{ paddingHorizontal: 16 }}><Note>Couldn’t save your open charts on this device.</Note><Action label="Retry saving" onPress={state.retryPersistence} /></View>}
    {state.loadError ? <View style={{ paddingHorizontal: 16 }}><Note>Couldn’t load charts stored on this device.</Note><Action label="Retry loading" onPress={state.retryLoad} /></View> : !state.loaded ? <ActivityIndicator accessibilityLabel="Loading charts" style={{ padding: 24 }} /> :
      !searching && !query && !selected.length && <Pressable accessibilityRole="button" accessibilityLabel="Open a Now chart" onPress={() => open('now')}
        style={({ pressed }) => ({ minHeight: 60, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 16, borderBottomWidth: .5, borderBottomColor: t.color.bdSecondary, backgroundColor: pressed ? t.color.bgPressed : t.color.bgSolidBase })}>
        <LibraryIcon name="clock" color={t.color.icAccent} /><View><Text style={[t.type.whyteSm, { color: t.color.txPrimary }]}>Current Transits</Text><Text style={[t.type.whyteXs, { color: t.color.txTertiary }]}>Now · current chart location</Text></View>
      </Pressable>}
  </>;
  const rows: ({ type: 'status' } | { type: 'chart'; chart: SavedChart })[] = [{ type: 'status' }, ...(state.loaded ? charts.map(chart => ({ type: 'chart' as const, chart })) : [])];
  return <><Stack.Screen options={{ headerShown: false }} />
    {/* Keep this root layout-only so Fabric flattens it: the native form-sheet
        content wrapper detects header + list siblings and sizes the list below
        the header. The header must remain one native view for that calculation. */}
    <View style={{ flex: 1 }}>
      {header}
      <FlatList data={rows} keyExtractor={row => row.type === 'status' ? 'status' : `chart:${row.chart.id}`} style={{ flex: 1, backgroundColor: t.color.bgSolidBase }}
        refreshing={refreshing} onRefresh={() => void refresh()} alwaysBounceVertical
        contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled" keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'} automaticallyAdjustKeyboardInsets
        renderItem={({ item }) => item.type === 'status' ? <View>{beforeRows}</View> : <LibraryRow chart={item.chart} onOpen={() => open(item.chart.id)} onAction={choice => action(item.chart, choice)} />}
        ListFooterComponent={state.loaded && !state.loadError && !charts.length ? <View style={{ padding: 24 }}>
          <Text style={[t.type.whyteSm, { color: t.color.txSecondary }]}>{query || selected.length ? 'No charts match these filters.' : 'No saved charts yet.'}</Text>
          {query || selected.length ? <Action label="Clear filters" onPress={() => { setQuery(''); setTagIds([]); }} /> : <Action label="Create your first chart" onPress={() => edit()} />}
        </View> : null} />
    </View>
    <ReplacementChooser active={state.active} visible={pending !== null} onCancel={() => setPending(null)} onSelect={id => { if (pending) open(pending, id); }} />
  </>;
}
function IconButton({ name, label, onPress }: { name: 'search' | 'plus' | 'close'; label: string; onPress: () => void }) {
  const t = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => ({ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: pressed ? t.color.bgPressed : 'transparent' })}><LibraryIcon name={name} color={t.color.icPrimary} /></Pressable>;
}
