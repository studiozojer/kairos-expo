import { Pressable, ScrollView, Text, View } from 'react-native';
import { useTheme } from '@/theme';
import type { CatalogStar } from './catalog';
import type { StarReference } from './library';
import { StarPosition } from './StarCatalogRow';
export function StarDetails({ reference, star, selected, ready, loading, status, onToggle }: { reference: StarReference; star?: CatalogStar; selected: boolean; ready: boolean; loading: boolean; status: string; onToggle: () => void }) {
  const t = useTheme();
  return <ScrollView contentContainerStyle={{ padding: t.space.lg, gap: t.space.lg, paddingBottom: 48 }}>
    <Text accessibilityRole="header" style={[t.type.whyteLg, { color: t.color.txPrimary }]}>{reference.name}</Text>
    {star ? <View style={{ backgroundColor: t.color.bgSolidCard, borderRadius: t.radius.md, padding: t.space.lg, gap: t.space.lg }}>
      {[['Designation', star.displayDesignation || 'Unavailable'], ['Constellation', star.constellation || 'Unavailable'], ['Magnitude', star.magnitude.toFixed(2)]].map(([label, value]) => <View key={label} style={{ gap: 6 }}><Text style={[t.type.whyteXs, { color: t.color.txSecondary }]}>{label}</Text><Text style={[label === 'Magnitude' ? t.type.fraktionSm : t.type.whyteSm, { color: t.color.txPrimary }]}>{value}</Text></View>)}
      <View style={{ gap: 8 }}><Text style={[t.type.whyteXs, { color: t.color.txSecondary }]}>Reference position · {star.sign}</Text><StarPosition star={star} /></View>
    </View> : <Text style={[t.type.whyteSm, { color: t.color.txSecondary }]}>{loading ? 'Loading catalog details…' : 'Details are unavailable in the loaded catalog. Your saved reference remains in your library until you remove it.'}</Text>}
    <Text style={[t.type.whyteXs, { color: t.color.txSecondary }]}>Tropical reference · 1 Jan 2000, 12:00 UTC. Chart positions use each chart’s date and zodiac system.</Text>
    {(star || selected) && <Pressable accessibilityRole="button" accessibilityLabel={selected ? 'Remove from my stars' : 'Add to my stars'} accessibilityState={{ disabled: !ready }} disabled={!ready} onPress={onToggle} style={({ pressed }) => ({ minHeight: 48, borderRadius: t.radius.md, padding: 12, backgroundColor: t.color.bgSolidCardSecondary, opacity: pressed || !ready ? .5 : 1 })}><Text style={[t.type.whyteSm, { color: t.color.txAccent }]}>{selected ? 'Remove from my stars' : 'Add to my stars'}</Text></Pressable>}
    <Text accessibilityLiveRegion="polite" style={[t.type.whyteXs, { color: t.color.txSecondary }]}>{status}</Text>
  </ScrollView>;
}
