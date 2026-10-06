import { useState } from 'react';
import { FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/theme';
import { useChartArchive } from '@/features/chart/transfers/ArchiveContext';
import { useActiveCharts } from '@/features/chart/active/ActiveChartsContext';
import { ReplacementChooser } from '@/features/chart/active/ReplacementChooser';
import { archiveDestination } from '@/features/chart/transfers/open';
import { currentPreview, sameReview, transferStatus, transferReasons } from '@/features/chart/transfers/presentation';
import { TransferReviewSheet } from '@/features/chart/transfers/TransferReviewSheet';
import { type ConversionPreview, conversionReason } from '@/features/chart/transfers/conversion';
import { useConversions } from '@/features/chart/transfers/useConversions';

/** Native stack/list mechanics; archive records never become wheel inputs here. */
export default function ChartTransfersScreen() {
  const t = useTheme(), router = useRouter();
  const archive = useChartArchive(), active = useActiveCharts();
  const conversions = useConversions(archive.scope, archive.records, active.reloadLibrary, archive.refresh);
  const [query, setQuery] = useState('');
  const [pending, setPending] = useState<{ transferId: string; destination: string } | null>(null);
  const records = archive.records.filter(record => record.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const [selection, setSelection] = useState<ConversionPreview[] | null>(null);
  const [reviewAccount, setReviewAccount] = useState<string | null>(null);
  const [details, setDetails] = useState<string | null>(null);
  const eligible = conversions.previews.filter(p => ['compatible', 'needs_review'].includes(p.state));
  const statuses = archive.records.map(r => transferStatus(r, currentPreview(r, conversions.previews)));
  const counts = [...new Set(statuses)].map(status => `${statuses.filter(s => s === status).length} ${status.toLowerCase()}`).join(' · ');
  const reviewValid = selection !== null && reviewAccount === archive.scope && archive.scope === active.scope && !archive.downloading && !conversions.busy && sameReview(selection, archive.records, conversions.previews);
  return <View style={{ flex: 1, backgroundColor: t.color.bgSolidBase, padding: t.space.lg }}>
    <Text style={{ ...t.type.whyteSm, color: t.color.txSecondary, marginBottom: t.space.md }}>
      Your transferred charts are safely archived in your account. Adding creates separate Saved Charts; your originals stay intact.
    </Text>
    {!archive.scope ? <Pressable accessibilityRole="button" onPress={() => router.push('/account')}>
      <Text style={{ ...t.type.whyteSm, color: t.color.txAccent }}>Sign in to the account you uploaded to</Text>
    </Pressable> : <>
      <Text style={{ ...t.type.fraktionXxs, color: t.color.txTertiary }}>{archive.records.length} archived · {counts}</Text>
      <Pressable accessibilityRole="button" disabled={conversions.busy || archive.downloading} onPress={() => void conversions.check()} style={{ paddingVertical: t.space.md }}>
        <Text style={{ ...t.type.whyteSm, color: t.color.txAccent }}>{conversions.busy ? 'Working…' : 'Check compatibility'}</Text>
      </Pressable>
      {!!eligible.length && <Pressable accessibilityRole="button" disabled={conversions.busy || archive.downloading} onPress={() => { setReviewAccount(archive.scope); setSelection(eligible); }} style={{ minHeight: 44, justifyContent: 'center' }}>
        <Text style={{ ...t.type.whyteSm, color: t.color.txAccent }}>Review all {eligible.length} {eligible.length === 1 ? 'chart' : 'charts'}</Text>
      </Pressable>}
      {!!eligible.length && !!query && <Text style={{ ...t.type.whyteXs, color: t.color.txSecondary }}>Search filters the list only. Review includes all {eligible.length} eligible charts.</Text>}
      {statuses.includes('Added to Saved Charts') && <Pressable accessibilityRole="button" onPress={() => router.push('/charts')} style={{ minHeight: 44, justifyContent: 'center' }}>
        <Text style={{ ...t.type.whyteSm, color: t.color.txAccent }}>View Saved Charts</Text>
      </Pressable>}
      {conversions.progress && <Text accessibilityLiveRegion="polite" style={{ ...t.type.whyteXs, color: t.color.txSecondary }}>{conversions.progress}</Text>}
      {conversions.error && <Text accessibilityRole="alert" style={{ ...t.type.whyteXs, color: t.color.txError }}>{conversions.error}</Text>}
      <TextInput accessibilityLabel="Search transferred charts" placeholder="Search transferred charts" value={query} onChangeText={setQuery}
        style={{ ...t.type.whyteSm, color: t.color.txPrimary, paddingVertical: t.space.md }} placeholderTextColor={t.color.txTertiary} />
      {archive.error && <Text accessibilityRole="alert" style={{ ...t.type.whyteXs, color: t.color.txError }}>{archive.error}</Text>}
      <FlatList data={records} keyExtractor={record => record.transferId} refreshing={archive.downloading} onRefresh={() => void archive.refresh()}
        ListEmptyComponent={<Text style={{ ...t.type.whyteSm, color: t.color.txSecondary }}>No transferred charts found{query ? ' for this search' : ' on this device yet'}.</Text>}
        renderItem={({ item }) => {
          const preview = currentPreview(item, conversions.previews);
          const destination = archive.scope === active.scope && (!preview || preview.state === 'already_added') ? archiveDestination(item, active.saved) : null;
          const reasons = transferReasons(item, preview);
          return <View style={{ paddingVertical: t.space.md, borderBottomWidth: t.border.hairline, borderColor: t.color.bdSecondary }}>
            <Text style={{ ...t.type.whyteSm, color: t.color.txPrimary }}>{item.name || 'Unnamed transferred chart'}</Text>
            <Text style={{ ...t.type.whyteXs, color: t.color.txSecondary, marginTop: t.space.xs }}>{transferStatus(item, preview)}</Text>
            {!!reasons.length && !['already_added', 'compatible'].includes(preview?.state ?? '') && <>
              <Pressable accessibilityRole="button" accessibilityLabel={`Details for ${item.name || 'Unnamed transferred chart'}`} accessibilityState={{ expanded: details === item.transferId }} onPress={() => setDetails(details === item.transferId ? null : item.transferId)} style={{ minHeight: 44, justifyContent: 'center' }}>
                <Text style={{ ...t.type.whyteXs, color: t.color.txAccent }}>{details === item.transferId ? 'Hide details' : 'Details'}</Text>
              </Pressable>
              {details === item.transferId && reasons.map(reason => <Text key={reason} style={{ ...t.type.whyteXs, color: t.color.txSecondary }}>{conversionReason(reason)}</Text>)}
            </>}
            {destination && <Pressable accessibilityRole="button" accessibilityLabel={`Open ${item.name}`} onPress={() => {
              // Recheck eligibility at the action boundary; raw snapshots never open.
              const current = archive.records.find(record => record.transferId === item.transferId);
              if (current && (!currentPreview(current, conversions.previews) || currentPreview(current, conversions.previews)?.state === 'already_added') && archiveDestination(current, active.saved) === destination) {
                if (active.openSaved(destination)) router.dismissTo('/(tabs)/(chart)');
                else setPending({ transferId: item.transferId, destination });
              }
            }} style={{ paddingVertical: t.space.sm }}><Text style={{ ...t.type.whyteSm, color: t.color.txAccent }}>Open chart</Text></Pressable>}
          </View>;
        }} />
    </>}
    {selection && <TransferReviewSheet selection={selection} records={archive.records} valid={reviewValid} onClose={() => setSelection(null)} onConfirm={() => {
      if (!reviewValid || !sameReview(selection, archive.records, conversions.previews)) return;
      const batch = selection; setSelection(null);
      void conversions.add(batch, batch.some(p => p.state === 'needs_review'));
    }} />}
    <ReplacementChooser active={active.active} visible={pending !== null} onCancel={() => setPending(null)} onSelect={replaceId => {
      if (!pending || archive.scope !== active.scope) return;
      const current = archive.records.find(record => record.transferId === pending.transferId);
      if (current && (!currentPreview(current, conversions.previews) || currentPreview(current, conversions.previews)?.state === 'already_added') && archiveDestination(current, active.saved) === pending.destination && active.openSaved(pending.destination, replaceId)) {
        setPending(null); router.dismissTo('/(tabs)/(chart)');
      }
    }} />
  </View>;
}
