import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useTheme } from '@/theme';
import { Action, Choices, Note } from '../display/controls';
import { useStarLibrary } from './useStarLibrary';
import { filterCatalog, loadStarCatalog, referencePosition, type CatalogStar } from './catalog';
export function StarLibraryPanel() {
  const t = useTheme();
  const { repository, state, ready, scope } = useStarLibrary();
  const [catalog, setCatalog] = useState<CatalogStar[]>([]);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');
  const [order, setOrder] = useState<'name' | 'position' | 'magnitude'>('name');
  useEffect(() => {
    let live = true;
    loadStarCatalog().then(stars => { if (live) setCatalog(stars); }, () => { if (live) setError('Couldn’t load the star catalog. Please try again.'); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [attempt]);
  const byId = useMemo(() => new Map(catalog.map(star => [star.id,star])),[catalog]);
  const selected = new Set(state.stars.map(star => star.id));
  const results = useMemo(() => filterCatalog(catalog,query,order),[catalog,query,order]);
  const details = (star: CatalogStar) => Alert.alert(star.name, `${star.displayDesignation} · ${star.constellation}\nMagnitude ${star.magnitude.toFixed(2)}\n${referencePosition(star)}\nTropical reference: 1 Jan 2000, 12:00 UTC. Chart positions use the chart’s own date and zodiac system.`);
  return <View style={{ flex: 1, paddingHorizontal: 22 }}>
    <Note>One personal library for every display preset. {scope ? 'Saved on this device for your account.' : 'Saved on this device while signed out.'}</Note>
    {state.loadError && <><Text accessibilityRole="alert" style={{ color:t.color.txAccent }}>Couldn’t restore your star library.</Text><Action label="Retry restoring star library" onPress={() => { void repository.load(); }} /><Action label="Reset star library" onPress={() => Alert.alert('Reset star library?', 'This replaces the saved star list for this account on this device.',[{ text:'Cancel',style:'cancel' },{ text:'Reset',style:'destructive',onPress:() => { void repository.reset(); } }])} /></>}
    {state.saveError && <Action label="Star changes haven’t been saved. Retry" onPress={() => { void repository.retrySave(); }} />}
    <Text accessibilityRole="header" style={[t.type.whyteSm,{ color:t.color.txPrimary }]}>My stars · {state.stars.length}</Text>
    <ScrollView horizontal style={{ flexGrow:0, minHeight:54 }} contentContainerStyle={{ alignItems:'center',gap:8 }}>
      {state.stars.map(reference => { const star = byId.get(reference.id); return <View key={reference.id} style={{ flexDirection:'row',alignItems:'center',backgroundColor:t.color.bgSolidCardSecondary,borderRadius:12 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Details for ${reference.name}`} onPress={() => star ? details(star) : Alert.alert(reference.name, loading ? 'Loading catalog details…' : 'Unavailable in the loaded catalog. You can remove this star or retry loading the catalog.')} style={{ minHeight:44,justifyContent:'center',paddingHorizontal:12 }}><Text style={[t.type.whyteXs,{color:t.color.txPrimary}]}>{reference.name}</Text></Pressable>
        <Pressable disabled={!ready} accessibilityRole="button" accessibilityLabel={`Remove ${reference.name}`} onPress={() => { void repository.remove(reference.id); }} style={{ width:44,height:44,alignItems:'center',justifyContent:'center' }}><Text style={{color:t.color.txAccent}}>×</Text></Pressable>
      </View>; })}
      {!state.stars.length && <Note>Choose stars below, then add a Fixed stars ring in Display → Details → Rings.</Note>}
    </ScrollView>
    <TextInput accessibilityLabel="Search stars" placeholder="Name, designation, or constellation" placeholderTextColor={t.color.txTertiary} value={query} onChangeText={setQuery} autoCorrect={false} style={[t.type.whyteSm,{ minHeight:44,color:t.color.txPrimary,borderBottomWidth:1,borderColor:t.color.bdSecondary }]} />
    <Choices label="Sort stars" value={order} options={[["name","Name"],["position","Position"],["magnitude","Brightness"]]} onChange={setOrder} />
    <Text style={[t.type.whyteXxs,{color:t.color.txTertiary}]}>{results.length} stars · Tropical positions at 1 Jan 2000, 12:00 UTC</Text>
    {loading && <ActivityIndicator accessibilityLabel="Loading star catalog" color={t.color.txAccent} />}
    {error && <><Text accessibilityRole="alert" style={{color:t.color.txAccent}}>{error}</Text><Action label="Retry star catalog" onPress={() => { setLoading(true); setError(undefined); setAttempt(value => value+1); }} /></>}
    <FlatList data={results} keyExtractor={star => star.id} keyboardShouldPersistTaps="handled" contentContainerStyle={{paddingBottom:32}}
      ListEmptyComponent={!loading && !error ? <Note>No stars match your search.</Note> : null}
      renderItem={({item:star}) => <View style={{ flexDirection:'row',alignItems:'center',borderBottomWidth:t.border.hairline,borderColor:t.color.bdSecondary }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Details for ${star.name}`} onPress={() => details(star)} style={{flex:1,minHeight:62,justifyContent:'center'}}>
          <Text style={[t.type.whyteSm,{color:t.color.txPrimary}]}>{star.name}</Text><Text style={[t.type.whyteXxs,{color:t.color.txTertiary}]}>{star.displayDesignation} · {referencePosition(star)}</Text>
        </Pressable>
        <Pressable disabled={!ready} accessibilityRole="checkbox" accessibilityLabel={`${selected.has(star.id) ? 'Remove' : 'Add'} ${star.name}`} accessibilityState={{ checked:selected.has(star.id),disabled:!ready }} onPress={() => { if (selected.has(star.id)) void repository.remove(star.id); else void repository.add(star.name); }} style={{minWidth:60,minHeight:44,alignItems:'center',justifyContent:'center'}}><Text style={[t.type.whyteXs,{color:ready ? t.color.txAccent : t.color.txTertiary}]}>{selected.has(star.id) ? '✓' : 'Add'}</Text></Pressable>
      </View>} />
  </View>;
}
