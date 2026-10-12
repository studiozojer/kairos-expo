import { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, Alert, FlatList, Keyboard, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View, findNodeHandle, type ViewProps } from 'react-native';
import { MenuView } from '@react-native-menu/menu';
import { useTheme } from '@/theme';
import { Action } from '../display/controls';
import { useStarLibrary } from './useStarLibrary';
import { filterCatalog, loadStarCatalog, type CatalogStar } from './catalog';
import type { StarReference } from './library';
import { StarCatalogRow } from './StarCatalogRow';
import { MyStarsRail } from './MyStarsRail';
import { StarDetails } from './StarDetails';
import { LibraryHeader, StarIcon } from './StarControls';
export interface StarLibraryPanelProps {
  onBack?: () => void;
  onClose?: () => void;
  /** Supplied by the invoker from live chart/layout state; absent for Account/defaults. */
  ringContext?: { message: string; onManage?: () => void };
}
const orders = { name: 'Name', position: 'Position', magnitude: 'Brightness' } as const;
export function StarLibraryPanel({ onBack, onClose, ringContext }: StarLibraryPanelProps) {
  const t = useTheme();
  const { repository, state, ready, scope } = useStarLibrary();
  const [catalog, setCatalog] = useState<CatalogStar[]>([]);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');
  const [order, setOrder] = useState<keyof typeof orders>('name');
  const [detail, setDetail] = useState<{ reference: StarReference; origin: string }>();
  const controls = useRef(new Map<string, View>());
  const search = useRef<TextInput>(null);
  const list = useRef<FlatList<CatalogStar>>(null);
  const offset = useRef(0);
  const restoreFocus = useRef<string | undefined>(undefined);
  // Account changes must never carry details or optimistic membership across owners.
  useEffect(() => { setDetail(undefined); }, [scope]);
  useEffect(() => {
    let live = true;
    loadStarCatalog().then(stars => { if (live) setCatalog(stars); }, () => { if (live) setError('Couldn’t load the star catalog. Please try again.'); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [attempt]);
  const byId = useMemo(() => new Map(catalog.map(star => [star.id, star])), [catalog]);
  const selected = useMemo(() => new Set(state.stars.map(star => star.id)), [state.stars]);
  const results = useMemo(() => filterCatalog(catalog, query, order), [catalog, query, order]);
  const status = state.loadError ? 'Couldn’t restore your star library.' : !state.loaded ? 'Restoring your star library…' : state.saving ? 'Saving changes on this device…' : state.saveError ? 'Changes haven’t been saved on this device.' : 'Shared across presets · saved on this device';
  const toggle = (reference: StarReference) => { if (!ready) return; if (selected.has(reference.id)) void repository.remove(reference.id); else void repository.add(reference.name); };
  const refFor = (key: string) => (node: View | null) => { if (node) controls.current.set(key, node); else controls.current.delete(key); };
  const showDetails = (reference: StarReference, origin: string) => { Keyboard.dismiss(); setDetail({ reference, origin }); };
  const closeDetails = () => { restoreFocus.current = detail?.origin; setDetail(undefined); };
  const help = () => Alert.alert('About your star library', `One personal roster is shared by every chart and display preset. ${scope ? 'This account’s library' : 'Your signed-out library'} is stored on this device; it does not sync between devices.\n\nFixed-star rings control how this roster is presented. In Display → Details → Rings, add or enable a Fixed stars ring and choose its chart source. Selecting a star here does not change your display preset. Catalog positions are a fixed tropical reference, not the open chart’s positions.`);
  const menuAccessibility: Pick<ViewProps, 'accessible' | 'accessibilityRole' | 'accessibilityLabel' | 'accessibilityHint'> = { accessible: true, accessibilityRole: 'button', accessibilityLabel: `Sort stars: ${orders[order]}`, accessibilityHint: 'Choose Name, Position or Brightness' };
  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: t.color.bgSolidBase }}>
    <LibraryHeader title={detail ? 'Star details' : undefined} onBack={detail ? closeDetails : onBack} onClose={onClose} />
    <View style={{ flex: 1, display: detail ? 'none' : 'flex' }} accessibilityElementsHidden={!!detail} importantForAccessibility={detail ? 'no-hide-descendants' : 'auto'} onLayout={() => {
      if (!restoreFocus.current) return;
      list.current?.scrollToOffset({ offset: offset.current, animated: false });
      const target = controls.current.get(restoreFocus.current); restoreFocus.current = undefined;
      if (target) { const handle = findNodeHandle(target); if (handle) AccessibilityInfo.setAccessibilityFocus(handle); }
    }}>
      <View style={{ paddingHorizontal: t.space.lg }}>
        <MyStarsRail stars={state.stars} disabled={!ready} onDetails={star => showDetails(star, `chip:${star.id}`)} onRemove={id => { void repository.remove(id); }} detailsRef={id => refFor(`chip:${id}`)} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text accessibilityLiveRegion="polite" style={[t.type.whyteXs, { flex: 1, color: t.color.txSecondary }]}>{status}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="About your star library" onPress={help} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><StarIcon name="info" color={t.color.txSecondary} /></Pressable>
        </View>
        {state.loadError && <><Action label="Retry restoring star library" onPress={() => { void repository.load(); }} /><Action label="Reset star library" onPress={() => Alert.alert('Reset star library?', 'This replaces the saved star list for this account on this device.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Reset', style: 'destructive', onPress: () => { void repository.reset(); } }])} /></>}
        {state.saveError && <Action label="Retry saving star changes" onPress={() => { void repository.retrySave(); }} />}
        {ringContext && <View style={{ backgroundColor: t.color.bgSolidCardSecondary, borderRadius: t.radius.md, paddingHorizontal: 12, paddingTop: 10, marginBottom: 12 }}>
          <Text style={[t.type.whyteXs, { color: t.color.txSecondary }]}>{ringContext.message}</Text>
          {ringContext.onManage && <Action label="Manage star rings" onPress={ringContext.onManage} />}
        </View>}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 12, borderWidth: t.border.hairline, borderColor: t.color.bdCard, borderRadius: t.radius.md, backgroundColor: t.color.bgSolidCardSecondary, minHeight: 48 }}>
          <StarIcon name="search" color={t.color.txSecondary} />
          <TextInput ref={search} accessibilityLabel="Search stars" placeholder="Name, designation, constellation" placeholderTextColor={t.color.txSecondary} value={query} onChangeText={value => { setQuery(value); offset.current = 0; list.current?.scrollToOffset({ offset: 0, animated: false }); }} autoCorrect={false} autoCapitalize="none" returnKeyType="search" onSubmitEditing={() => Keyboard.dismiss()} style={[t.type.whyteSm, { flex: 1, paddingVertical: 12, color: t.color.txPrimary }]} />
          {query ? <Pressable accessibilityRole="button" accessibilityLabel="Clear star search" onPress={() => { setQuery(''); offset.current = 0; list.current?.scrollToOffset({ offset: 0, animated: false }); search.current?.focus(); }} style={{ minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' }}><StarIcon name="close" color={t.color.txSecondary} /></Pressable> : <View style={{ width: 12 }} />}
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingVertical: 10 }}>
          <Text accessibilityRole="header" style={[t.type.whyteSm, { color: t.color.txPrimary }]}>Star catalog <Text style={[t.type.whyteXs, { color: t.color.txSecondary }]}>· {results.length}</Text></Text>
          <MenuView {...menuAccessibility} title="Sort stars" shouldOpenOnLongPress={false} isAnchoredToRight themeVariant={t.scheme} actions={Object.entries(orders).map(([id, title]) => ({ id, title, state: id === order ? 'on' : 'off' }))} onPressAction={({ nativeEvent: { event } }) => { if (event in orders) { setOrder(event as keyof typeof orders); offset.current = 0; list.current?.scrollToOffset({ offset: 0, animated: false }); } }} style={{ minHeight: 44, justifyContent: 'center' }}>
            <View pointerEvents="none" style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Text style={[t.type.whyteXs, { color: t.color.txSecondary }]}>Sort: {orders[order]}</Text><StarIcon name="down" size={16} color={t.color.txSecondary} /></View>
          </MenuView>
        </View>
      </View>
      {loading && <ActivityIndicator accessibilityLabel="Loading star catalog" color={t.color.txAccent} />}
      {error && <View style={{ paddingHorizontal: t.space.lg }}><Text accessibilityRole="alert" style={[t.type.whyteSm, { color: t.color.txPrimary }]}>{error}</Text><Action label="Retry star catalog" onPress={() => { setLoading(true); setError(undefined); setAttempt(value => value + 1); }} /></View>}
      <FlatList ref={list} data={results} keyExtractor={star => star.id} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" onScroll={event => { offset.current = event.nativeEvent.contentOffset.y; }} scrollEventThrottle={100} contentContainerStyle={{ paddingHorizontal: t.space.lg, paddingBottom: 32 }} ListEmptyComponent={!loading && !error ? <Text style={[t.type.whyteSm, { color: t.color.txSecondary, paddingVertical: 24 }]}>No stars match your search.</Text> : null}
        renderItem={({ item: star }) => <StarCatalogRow star={star} selected={selected.has(star.id)} disabled={!ready} onToggle={() => toggle(star)} onDetails={() => showDetails(star, `row:${star.id}`)} infoRef={refFor(`row:${star.id}`)} />} />
    </View>
    {detail && <StarDetails reference={detail.reference} star={byId.get(detail.reference.id)} selected={selected.has(detail.reference.id)} ready={ready} loading={loading} status={status} onToggle={() => toggle(detail.reference)} />}
  </KeyboardAvoidingView>;
}
