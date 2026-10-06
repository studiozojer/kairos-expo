import { useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/theme';
import { useChartArchive } from '@/features/chart/transfers/ArchiveContext';
import { exceptionReason, chartExceptions } from '@/features/chart/transfers/presentation';

/** Exceptions are informational; supported charts arrive in Saved Charts automatically. */
export default function ChartExceptionsScreen() {
  const t = useTheme(), router = useRouter(), account = useChartArchive();
  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try { await account.refresh(); } finally { setRefreshing(false); }
  };
  const [query, setQuery] = useState(''), [details, setDetails] = useState<string | null>(null);
  const exceptions = chartExceptions(account.previews, account.records).map(preview => ({ preview, source: account.records.find(r => r.transferId === preview.transferId) }));
  const rows = exceptions.filter(({ source }) => (source?.name ?? '').toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  return <View style={{ flex: 1, backgroundColor: t.color.bgSolidBase, padding: t.space.lg }}>
    <Text style={[t.type.whyteSm, { color: t.color.txSecondary, marginBottom: t.space.md }]}>These charts need attention. Your originals remain safely archived. Supported charts appear in Saved Charts automatically.</Text>
    {!account.scope ? <Pressable accessibilityRole="button" onPress={() => router.push('/account')} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={[t.type.whyteSm, { color: t.color.txAccent }]}>Sign in to see your charts</Text></Pressable> : <>
      {(account.initialLoading || (account.downloading && !exceptions.length)) && <Text accessibilityLiveRegion="polite" style={[t.type.whyteXs, { color: t.color.txSecondary }]}>Loading your charts…</Text>}
      {account.error && <><Text accessibilityRole="alert" style={[t.type.whyteXs, { color: t.color.txError }]}>{account.error}</Text><Pressable accessibilityRole="button" onPress={() => void account.refresh()} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={[t.type.whyteSm, { color: t.color.txAccent }]}>Retry loading charts</Text></Pressable></>}
      <TextInput accessibilityLabel="Search chart exceptions" placeholder="Search chart exceptions" value={query} onChangeText={setQuery} style={[t.type.whyteSm, { color: t.color.txPrimary, minHeight: 44 }]} />
      <FlatList data={rows} keyExtractor={item => item.preview.transferId} refreshing={refreshing} onRefresh={() => void refresh()}
        ListEmptyComponent={!account.downloading && !account.initialLoading && !account.error ? <Text style={[t.type.whyteSm, { color: t.color.txSecondary }]}>{query ? 'No exceptions match this search.' : 'No chart exceptions.'}</Text> : null}
        renderItem={({ item: { preview, source } }) => <View style={{ paddingVertical: t.space.md, borderBottomWidth: t.border.hairline, borderColor: t.color.bdSecondary }}>
          <Text style={[t.type.whyteSm, { color: t.color.txPrimary }]}>{source?.name || 'Unnamed chart'}</Text>
          <Text style={[t.type.whyteXs, { color: t.color.txSecondary, marginTop: t.space.xs }]}>{exceptionReason(preview.state === 'source_changed' ? 'source_changed' : preview.reasons[0])}</Text>
          {preview.reasons.length > 1 && <><Pressable accessibilityRole="button" accessibilityLabel={`Details for ${source?.name || 'Unnamed chart'}`} accessibilityState={{ expanded: details === preview.transferId }} onPress={() => setDetails(details === preview.transferId ? null : preview.transferId)} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={[t.type.whyteXs, { color: t.color.txAccent }]}>{details === preview.transferId ? 'Hide details' : 'Details'}</Text></Pressable>
            {details === preview.transferId && preview.reasons.slice(1).map(reason => <Text key={reason} style={[t.type.whyteXs, { color: t.color.txSecondary }]}>{exceptionReason(reason)}</Text>)}</>}
        </View>} />
    </>}
  </View>;
}
