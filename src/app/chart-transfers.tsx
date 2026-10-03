import { useState } from 'react';
import { Alert, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/theme';
import { useChartArchive } from '@/features/chart/transfers/ArchiveContext';
import { useActiveCharts } from '@/features/chart/active/ActiveChartsContext';
import { ReplacementChooser } from '@/features/chart/active/ReplacementChooser';
import { archiveDestination } from '@/features/chart/transfers/open';
import { compatibilityLabel } from '@/features/chart/transfers/types';
import { conversionReason } from '@/features/chart/transfers/conversion';
import { useConversions } from '@/features/chart/transfers/useConversions';

/** Native stack/list mechanics; archive records never become wheel inputs here. */
export default function ChartTransfersScreen() {
  const t = useTheme(), router = useRouter();
  const archive = useChartArchive(), active = useActiveCharts();
  const conversions = useConversions(archive.scope, archive.records, active.reloadLibrary, archive.refresh);
  const [query, setQuery] = useState('');
  const [pending, setPending] = useState<{ transferId: string; destination: string } | null>(null);
  const records = archive.records.filter(record => record.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const compatible = conversions.previews.filter(p => p.state === 'compatible');
  const review = conversions.previews.filter(p => p.state === 'needs_review');
  const confirmReview = () => {
    const reasons = [...new Set(review.flatMap(p => p.reasons))];
    Alert.alert('Review charts before adding',
      `${review.length} charts can be added using these confirmed choices:\n\n${reasons.map(conversionReason).join('\n\n')}\n\nExpo uses Tropical zodiac, Mean node and Mean Lilith. Unsupported settings remain in the archive. Original charts and uploaded snapshots stay intact.`,
      [{ text: 'Cancel', style: 'cancel' }, { text: 'Confirm and add', onPress: () => { void conversions.add(review, true); } }]);
  };
  return <View style={{ flex: 1, backgroundColor: t.color.bgSolidBase, padding: t.space.lg }}>
    <Text style={{ ...t.type.whyteSm, color: t.color.txSecondary, marginBottom: t.space.md }}>
      Charts transferred from the old Kairos app are saved privately in your account. Some need additional support before they can open here. Your originals stay in the old app.
    </Text>
    {!archive.scope ? <Pressable accessibilityRole="button" onPress={() => router.push('/account')}>
      <Text style={{ ...t.type.whyteSm, color: t.color.txAccent }}>Sign in to the account you uploaded to</Text>
    </Pressable> : <>
      <Text style={{ ...t.type.fraktionXxs, color: t.color.txTertiary }}>{archive.records.length} received · {archive.records.filter(record => record.compatibility.state === 'ready').length} assessed ready</Text>
      <Pressable accessibilityRole="button" disabled={conversions.busy || archive.downloading} onPress={() => void conversions.check()} style={{ paddingVertical: t.space.md }}>
        <Text style={{ ...t.type.whyteSm, color: t.color.txAccent }}>{conversions.busy ? 'Working…' : 'Check compatibility for Saved Charts'}</Text>
      </Pressable>
      {!!compatible.length && <Pressable accessibilityRole="button" disabled={conversions.busy} onPress={() => void conversions.add(compatible, false)} style={{ paddingVertical: t.space.sm }}>
        <Text style={{ ...t.type.whyteSm, color: t.color.txAccent }}>Add {compatible.length} compatible charts to Saved Charts</Text>
      </Pressable>}
      {!!review.length && <Pressable accessibilityRole="button" disabled={conversions.busy} onPress={confirmReview} style={{ paddingVertical: t.space.sm }}>
        <Text style={{ ...t.type.whyteSm, color: t.color.txAccent }}>Review and add {review.length} charts</Text>
      </Pressable>}
      {conversions.progress && <Text style={{ ...t.type.whyteXs, color: t.color.txSecondary }}>{conversions.progress}</Text>}
      {conversions.error && <Text accessibilityRole="alert" style={{ ...t.type.whyteXs, color: t.color.txError }}>{conversions.error}</Text>}
      <TextInput accessibilityLabel="Search transferred charts" placeholder="Search transferred charts" value={query} onChangeText={setQuery}
        style={{ ...t.type.whyteSm, color: t.color.txPrimary, paddingVertical: t.space.md }} placeholderTextColor={t.color.txTertiary} />
      {archive.error && <Text accessibilityRole="alert" style={{ ...t.type.whyteXs, color: t.color.txError }}>{archive.error}</Text>}
      <FlatList data={records} keyExtractor={record => record.transferId} refreshing={archive.downloading} onRefresh={() => void archive.refresh()}
        ListEmptyComponent={<Text style={{ ...t.type.whyteSm, color: t.color.txSecondary }}>No transferred charts found{query ? ' for this search' : ' on this device yet'}.</Text>}
        renderItem={({ item }) => {
          const destination = archive.scope === active.scope ? archiveDestination(item, active.saved) : null;
          const preview = conversions.previews.find(p => p.transferId === item.transferId);
          return <View style={{ paddingVertical: t.space.md, borderBottomWidth: t.border.hairline, borderColor: t.color.bdSecondary }}>
            <Text style={{ ...t.type.whyteSm, color: t.color.txPrimary }}>{item.name || 'Unnamed transferred chart'}</Text>
            <Text style={{ ...t.type.whyteXs, color: t.color.txSecondary, marginTop: t.space.xs }}>{compatibilityLabel(item.compatibility)}</Text>
            {preview?.state === 'already_added' && <Text style={{ ...t.type.whyteXs, color: t.color.txSecondary }}>Added to Saved Charts</Text>}
            {preview?.state === 'source_changed' && <Text style={{ ...t.type.whyteXs, color: t.color.txSecondary }}>Original changed; your saved copy stays unchanged.</Text>}
            {preview?.state === 'deleted' && <Text style={{ ...t.type.whyteXs, color: t.color.txSecondary }}>Saved copy was deleted. Adding again will not restore it automatically.</Text>}
            {preview && ['unsupported', 'needs_review'].includes(preview.state) && preview.reasons.map(reason => <Text key={reason} style={{ ...t.type.whyteXs, color: t.color.txSecondary }}>{conversionReason(reason)}</Text>)}
            {destination && <Pressable accessibilityRole="button" accessibilityLabel={`Open ${item.name}`} onPress={() => {
              // Recheck eligibility at the action boundary; raw snapshots never open.
              const current = archive.records.find(record => record.transferId === item.transferId);
              if (current && archiveDestination(current, active.saved) === destination) {
                if (active.openSaved(destination)) router.dismissTo('/(tabs)/(chart)');
                else setPending({ transferId: item.transferId, destination });
              }
            }} style={{ paddingVertical: t.space.sm }}><Text style={{ ...t.type.whyteSm, color: t.color.txAccent }}>Open chart</Text></Pressable>}
          </View>;
        }} />
    </>}
    <ReplacementChooser active={active.active} visible={pending !== null} onCancel={() => setPending(null)} onSelect={replaceId => {
      if (!pending || archive.scope !== active.scope) return;
      const current = archive.records.find(record => record.transferId === pending.transferId);
      if (current && archiveDestination(current, active.saved) === pending.destination && active.openSaved(pending.destination, replaceId)) {
        setPending(null); router.dismissTo('/(tabs)/(chart)');
      }
    }} />
  </View>;
}
