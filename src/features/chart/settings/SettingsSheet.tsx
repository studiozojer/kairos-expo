import { ChartSheet, SheetHeader, SheetBackRow } from '../components/ChartSheet';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';
import { Action, LinkRow, Note, Row, Section } from '../display/controls';
import { HOUSE_SYSTEMS, type ChartLocation, type ChartSettings } from './chartSettings';
import { searchAtlas } from './atlas';

interface Props {
  visible: boolean;
  settings: ChartSettings;
  saveError: boolean;
  onChange: (next: ChartSettings) => void;
  onClose: () => void;
}
// Let Modal retain the editor until native dismissal finishes, as Display does.
export function SettingsSheet(props: Props) {
  return <ChartSheet visible={props.visible} onClose={props.onClose}>
    <SettingsEditor {...props} />
  </ChartSheet>;
}
function SettingsEditor({ settings, saveError, onChange, onClose }: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState<'location' | 'houses' | null>(null);
  return <View style={{ flex: 1, backgroundColor: t.color.bgSolidBase, paddingTop: insets.top, paddingBottom: insets.bottom }}>
    <SheetHeader title="Settings" closeLabel="Close chart settings" onClose={onClose} />
    {page && <SheetBackRow title={page === 'location' ? 'Location' : 'House system'} onBack={() => setPage(null)} />}
    {saveError && <Text accessibilityRole="alert" style={[t.type.whyteXs, { color: t.color.txAccent, paddingHorizontal: t.space.lg }]}>Couldn’t save this open chart’s settings. Retry saving from the chart screen.</Text>}
    {page === 'location' ? <LocationPicker selected={settings.location} onSelect={location => { onChange({ ...settings, location }); setPage(null); }} /> :
      <ScrollView contentContainerStyle={{ padding: t.space.lg }}>
        {page === 'houses' ? <Section title="House system">
          {HOUSE_SYSTEMS.map(system => <Pressable key={system} accessibilityRole="radio" accessibilityLabel={system}
            accessibilityState={{ checked: settings.houseSystem === system }} onPress={() => onChange({ ...settings, houseSystem: system })}>
            <Row label={system}>{settings.houseSystem === system && <Text style={{ color: t.color.txAccent }}>✓</Text>}</Row>
          </Pressable>)}
        </Section> : <>
          <Note>Changes apply to this open chart only. Saved charts remain unchanged.</Note><Section title="Location"><LinkRow label="Location" detail={settings.location.name} onPress={() => setPage('location')} /></Section>
          <Section title="Chart"><LinkRow label="House system" detail={settings.houseSystem} onPress={() => setPage('houses')} /></Section>
        </>}
      </ScrollView>}
  </View>;
}
function LocationPicker({ selected, onSelect }: { selected: ChartLocation; onSelect: (location: ChartLocation) => void }) {
  const t = useTheme();
  const [query, setQuery] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [results, setResults] = useState<ChartLocation[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  useEffect(() => {
    let active = true;
    if (query.trim().length < 2) return;
    const timer = setTimeout(() => {
      searchAtlas(query).then(locations => {
        if (active) { setResults(locations); setStatus('ready'); }
      }, () => { if (active) setStatus('error'); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [query, attempt]);
  return <View style={{ flex: 1, paddingHorizontal: t.space.lg }}>
    <TextInput accessibilityLabel="Search atlas" placeholder="Search city, region or country" placeholderTextColor={t.color.txTertiary}
      autoCorrect={false} autoCapitalize="words" value={query} onChangeText={value => { setQuery(value); setResults([]); setStatus(value.trim().length < 2 ? 'idle' : 'loading'); }} returnKeyType="search"
      style={[t.type.whyteSm, { minHeight: 48, padding: t.space.md, color: t.color.txPrimary, backgroundColor: t.color.bgSolidCardSecondary, borderRadius: t.radius.md }]} />
    <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ paddingVertical: t.space.lg }}>
      {status === 'idle' && <><Note>Search the offline atlas to choose a city.</Note><Row label={selected.name} detail="Current location" /></>}
      {status === 'loading' && <ActivityIndicator accessibilityLabel="Searching atlas" color={t.color.txAccent} />}
      {status === 'error' && <><Text accessibilityRole="alert" style={[t.type.whyteSm, { color: t.color.txPrimary }]}>Couldn’t search the atlas.</Text><Action label="Retry" onPress={() => { setStatus('loading'); setAttempt(value => value + 1); }} /></>}
      {status === 'ready' && results.length === 0 && <Note>No locations found. Try a city name, with a region or country if needed.</Note>}
      {results.map((location, index) => <LinkRow key={`${location.name}:${location.latitude}:${location.longitude}:${index}`} label={location.name} detail={location.timezone} onPress={() => onSelect(location)} />)}
    </ScrollView>
  </View>;
}
