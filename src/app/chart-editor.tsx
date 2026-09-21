import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '@/theme';
import { Action, Choices, LinkRow, Note, Section } from '@/features/chart/display/controls';
import { useActiveCharts } from '@/features/chart/active/ActiveChartsContext';
import type { SavedChart } from '@/features/chart/active/model';
import { ReplacementChooser } from '@/features/chart/active/ReplacementChooser';
import { chartDateLabel, localFields, resolveWallTime } from '@/features/chart/active/wallTime';
import { DEFAULT_SETTINGS, HOUSE_SYSTEMS, isLocation, type ChartLocation } from '@/features/chart/settings/chartSettings';
import { searchAtlas } from '@/features/chart/settings/atlas';

function Field({ label, value, onChange, numeric = false }: { label: string; value: string; onChange: (value: string) => void; numeric?: boolean }) {
  const t = useTheme();
  return <View style={{ marginBottom: 12 }}><Text style={[t.type.whyteXs, { color: t.color.txSecondary, marginBottom: 6 }]}>{label}</Text>
    <TextInput accessibilityLabel={label} value={value} onChangeText={onChange} autoCorrect={false} autoCapitalize="none"
      keyboardType={numeric ? 'numbers-and-punctuation' : 'default'}
      style={[t.type.whyteSm, { color: t.color.txPrimary, padding: 12, minHeight: 48, backgroundColor: t.color.bgSolidCardSecondary, borderRadius: t.radius.md }]} />
  </View>;
}

export default function ChartEditorScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const state = useActiveCharts();
  const saved = state.saved.find(chart => chart.id === id);
  return <><Stack.Screen options={{ title: id ? 'Edit chart' : 'Create chart' }} />
    {state.loadError ? <><Note>Couldn’t load saved charts.</Note><Action label="Retry loading" onPress={state.retryLoad} /></> : !state.loaded ? <ActivityIndicator accessibilityLabel="Loading chart" /> :
      id && !saved ? <Note>This saved chart was not found.</Note> : <Editor key={id ?? 'new'} saved={saved} />}
  </>;
}
function Editor({ saved }: { saved?: SavedChart }) {
  const state = useActiveCharts();
  const t = useTheme();
  const router = useRouter();
  const initialSettings = saved?.settings ?? DEFAULT_SETTINGS;
  const initialFields = useMemo(() => localFields(saved ? Date.parse(saved.datetime) : Date.now(), initialSettings.location.timezone), []);
  const [name, setName] = useState(saved?.name ?? '');
  const [date, setDate] = useState(initialFields.date);
  const [clock, setClock] = useState(initialFields.clock);
  const [locationName, setLocationName] = useState(initialSettings.location.name);
  const [latitude, setLatitude] = useState(String(initialSettings.location.latitude));
  const [longitude, setLongitude] = useState(String(initialSettings.location.longitude));
  const [elevation, setElevation] = useState(String(initialSettings.location.elevation));
  const [timezone, setTimezone] = useState(initialSettings.location.timezone);
  const [houseSystem, setHouseSystem] = useState(initialSettings.houseSystem);
  const [fold, setFold] = useState<number | null>(() => {
    if (!saved) return null;
    const candidates = resolveWallTime(initialFields.date, initialFields.clock, initialSettings.location.timezone);
    const match = candidates.indexOf(Date.parse(saved.datetime));
    return match >= 0 ? match : null;
  });
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ChartLocation[]>([]);
  const [atlasStatus, setAtlasStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [atlasAttempt, setAtlasAttempt] = useState(0);
  const [error, setError] = useState('');
  const [savedId, setSavedId] = useState(saved?.id);
  const [savedMessage, setSavedMessage] = useState(false);
  const [replacement, setReplacement] = useState<string | null>(null);
  useEffect(() => { setSavedMessage(false); }, [name, date, clock, locationName, latitude, longitude, elevation, timezone, houseSystem, fold]);
  const wall = useMemo(() => {
    try { return { candidates: resolveWallTime(date, clock, timezone), error: '' }; }
    catch (cause) { return { candidates: [], error: (cause as Error).message }; }
  }, [date, clock, timezone]);
  useEffect(() => {
    let live = true;
    setResults([]);
    if (query.trim().length < 2) { setAtlasStatus('idle'); return; }
    setAtlasStatus('loading');
    const timer = setTimeout(() => { searchAtlas(query).then(locations => {
      if (live) { setResults(locations); setAtlasStatus('ready'); }
    }, () => { if (live) setAtlasStatus('error'); }); }, 250);
    return () => { live = false; clearTimeout(timer); };
  }, [query, atlasAttempt]);
  const chooseLocation = (location: ChartLocation) => {
    setLocationName(location.name); setLatitude(String(location.latitude)); setLongitude(String(location.longitude));
    setElevation(String(location.elevation)); setTimezone(location.timezone); setFold(null); setQuery('');
  };
  const open = (id: string, replaceId?: string) => {
    if (state.openSaved(id, replaceId)) { setReplacement(null); router.dismissTo('/(tabs)/(chart)'); }
    else setReplacement(id);
  };
  const save = (andOpen: boolean) => {
    setError(''); setSavedMessage(false);
    if (!name.trim()) { setError('Give this chart a name.'); return; }
    if (wall.error) { setError(wall.error); return; }
    if (wall.candidates.length > 1 && fold === null) { setError('This time occurs twice. Choose its earlier or later occurrence.'); return; }
    const location = { name: locationName.trim(), latitude: Number(latitude), longitude: Number(longitude), elevation: Number(elevation), timezone: timezone.trim() };
    if (![latitude, longitude, elevation].every(value => value.trim()) || !isLocation(location)) {
      setError('Enter a location name, latitude (−90 to 90), longitude (−180 to 180), elevation and valid timezone.'); return;
    }
    try {
      const chart = state.saveChart({ name: name.trim(), datetime: new Date(wall.candidates[fold ?? 0]).toISOString(), settings: { location, houseSystem } }, savedId);
      setSavedId(chart.id); setSavedMessage(true);
      if (andOpen) open(chart.id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Couldn’t save the chart.'); }
  };
  return <KeyboardAvoidingView style={{ flex: 1, backgroundColor: t.color.bgSolidBase }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ padding: t.space.lg, paddingBottom: 64 }}>
      <Section title="Identity"><Field label="Chart name" value={name} onChange={setName} /></Section>
      <Section title="Local date and time">
        <Field label="Date · YYYY-MM-DD" value={date} onChange={value => { setDate(value); setFold(null); }} />
        <Field label="Time · HH:mm:ss (24-hour)" value={clock} onChange={value => { setClock(value); setFold(null); }} />
        <Note>Enter the clock time at the chart’s location, from 1900–2099. The timezone below determines its UTC instant.</Note>
        {wall.candidates.length > 1 && <Choices label="This time occurs twice" value={fold ?? undefined}
          options={wall.candidates.map((time, index) => [index, `${index === 0 ? 'Earlier' : 'Later'} · ${new Date(time).toISOString()}`] as const)} onChange={setFold} />}
        {wall.candidates.length === 1 && <Note>UTC: {new Date(wall.candidates[0]).toISOString()}</Note>}
      </Section>
      <Section title="Location">
        <Field label="Search offline atlas" value={query} onChange={setQuery} />
        {atlasStatus === 'loading' && <ActivityIndicator accessibilityLabel="Searching atlas" />}
        {atlasStatus === 'error' && <><Note>Atlas search failed. Retry or enter coordinates and timezone below.</Note><Action label="Retry atlas search" onPress={() => setAtlasAttempt(v => v + 1)} /></>}
        {atlasStatus === 'ready' && !results.length && <Note>No matches. Try another city or enter the location manually.</Note>}
        {results.slice(0, 20).map((location, i) => <LinkRow key={`${location.name}:${i}`} label={location.name} detail={location.timezone} onPress={() => chooseLocation(location)} />)}
        <Field label="Location name" value={locationName} onChange={setLocationName} />
        <Field label="Latitude · north positive" value={latitude} onChange={setLatitude} numeric />
        <Field label="Longitude · east positive" value={longitude} onChange={setLongitude} numeric />
        <Field label="Elevation · meters" value={elevation} onChange={setElevation} numeric />
        <Field label="IANA timezone" value={timezone} onChange={value => { setTimezone(value); setFold(null); }} />
        <Note>For example America/Los_Angeles, Europe/London or UTC. Choosing a new location keeps the entered local clock time.</Note>
      </Section>
      <Section title="Calculation"><Choices label="House system" value={houseSystem} options={HOUSE_SYSTEMS.map(system => [system, system] as const)} onChange={setHouseSystem} />
        <Note>Tropical zodiac · mean lunar node. These are the calculation modes currently supported.</Note>
      </Section>
      {error && <Text accessibilityRole="alert" style={[t.type.whyteSm, { color: t.color.txAccent }]}>{error}</Text>}
      {state.saveError ? <><Text accessibilityRole="alert" style={{ color: t.color.txAccent }}>Changes are in memory but could not be saved on this device.</Text><Action label="Retry saving" onPress={state.retryPersistence} /></> :
        savedMessage && <Note>{state.saving ? 'Saving on this device…' : 'Saved on this device. Existing open copies keep their own settings and time.'}</Note>}
      <Action label="Save chart" onPress={() => save(false)} /><Action label="Save and open" onPress={() => save(true)} />
      {saved && <Note>Original: {chartDateLabel(Date.parse(saved.datetime), saved.settings.location.timezone)}</Note>}
    </ScrollView>
    <ReplacementChooser active={state.active} visible={replacement !== null} onCancel={() => setReplacement(null)} onSelect={id => { if (replacement) open(replacement, id); }} />
  </KeyboardAvoidingView>;
}
