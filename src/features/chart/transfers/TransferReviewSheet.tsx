import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';
import { ChartSheet, SheetHeader } from '../components/ChartSheet';
import { Action, Note, Section } from '../display/controls';
import { conversionReason, type ConversionPreview } from './conversion';
import { reviewGroups } from './presentation';
import type { ArchivedChart } from './types';

export function TransferReviewSheet({ selection, records, valid, onClose, onConfirm }: {
  selection: ConversionPreview[]; records: ArchivedChart[]; valid: boolean; onClose: () => void; onConfirm: () => void;
}) {
  const t = useTheme(), insets = useSafeAreaInsets();
  const [expanded, setExpanded] = useState<string | null>(null);
  const count = `${selection.length} ${selection.length === 1 ? 'chart' : 'charts'}`;
  const groups = reviewGroups(selection);
  const members = (key: string, values: ConversionPreview[]) => <>
    <Pressable accessibilityRole="button" accessibilityLabel={`View charts: ${key}`} accessibilityState={{ expanded: expanded === key }}
      onPress={() => setExpanded(expanded === key ? null : key)} style={{ minHeight: 44, justifyContent: 'center' }}>
      <Text style={[t.type.whyteXs, { color: t.color.txAccent }]}>{expanded === key ? 'Hide charts' : `View ${values.length} charts`}</Text>
    </Pressable>
    {expanded === key && values.map(p => <Text key={p.transferId} style={[t.type.whyteXs, { color: t.color.txSecondary, marginBottom: t.space.sm }]}>
      {records.find(r => r.transferId === p.transferId)?.name || 'Unnamed transferred chart'}
    </Text>)}
  </>;
  return <ChartSheet visible onClose={onClose}><View style={{ flex: 1, backgroundColor: t.color.bgSolidBase, paddingTop: insets.top, paddingBottom: insets.bottom }}>
    <SheetHeader title="Review import" closeLabel="Cancel chart import" onClose={onClose} />
    <ScrollView contentContainerStyle={{ padding: t.space.lg }}>
      <Text accessibilityRole="header" style={[t.type.whyteMd, { color: t.color.txPrimary }]}>Add {count} to Saved Charts</Text>
      <Note>This batch includes all eligible charts in your transferred library. Search does not change the batch. Adding creates separate saved copies; your originals stay intact.</Note>
      <Section title="Calculation settings">{groups.settings.map(([label, values]) => <View key={label} style={{ marginBottom: t.space.md }}>
        <Text style={[t.type.whyteSm, { color: t.color.txPrimary }]}>{label}</Text>
        <Text style={[t.type.whyteXs, { color: t.color.txSecondary }]}>{values.length === selection.length ? `All ${values.length} charts` : `${values.length} charts`}</Text>
        {members(label, values)}
      </View>)}</Section>
      {groups.reasons.length ? <Section title="Confirm these choices">{groups.reasons.map(([reason, values]) => <View key={reason} style={{ marginBottom: t.space.md }}>
        <Text style={[t.type.whyteXs, { color: t.color.txSecondary }]}>{values.length === selection.length ? `All ${values.length} charts` : `${values.length} of ${selection.length} charts`}</Text>
        <Text style={[t.type.whyteSm, { color: t.color.txPrimary }]}>{conversionReason(reason)}</Text>
        {members(reason, values)}
      </View>)}</Section> : <Note>These charts have complete, supported calculation inputs.</Note>}
      {!valid && <Text accessibilityRole="alert" style={[t.type.whyteXs, { color: t.color.txError }]}>The library or assessment changed. Close this review and check compatibility again.</Text>}
      <Pressable accessibilityRole="button" accessibilityLabel={`Confirm and add ${count}`} accessibilityState={{ disabled: !valid }} disabled={!valid}
        onPress={onConfirm} style={{ minHeight: 48, justifyContent: 'center', marginVertical: t.space.md, opacity: valid ? 1 : .5 }}>
        <Text style={[t.type.whyteSm, { color: t.color.txAccent }]}>Confirm and add {count}</Text>
      </Pressable>
      <Action label="Cancel" onPress={onClose} />
    </ScrollView>
  </View></ChartSheet>;
}
