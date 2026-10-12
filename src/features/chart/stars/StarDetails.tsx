import { StarText as Text } from './StarText';
import { StarAction } from './StarControls';
import { useRef } from 'react';
import { AccessibilityInfo, findNodeHandle, Text as NativeText, ScrollView, View } from 'react-native';
import { useTheme } from '@/theme';
import type { CatalogStar } from './catalog';
import type { StarReference } from './library';
import { StarPosition } from './StarCatalogRow';
export function StarDetails({ reference, star, selected, ready, loading, catalogError, saveError, onRetryCatalog, onRetrySave, status, onToggle }: { reference: StarReference; star?: CatalogStar; selected: boolean; ready: boolean; loading: boolean; catalogError: boolean; saveError: boolean; onRetryCatalog: () => void; onRetrySave: () => void; status: string; onToggle: () => void }) {
  const t = useTheme();
  const heading = useRef<NativeText>(null);
  return <ScrollView contentContainerStyle={{ padding: t.space.lg, gap: t.space.lg, paddingBottom: 48 }}>
    <Text ref={heading} onLayout={() => { const handle = heading.current && findNodeHandle(heading.current); if (handle) AccessibilityInfo.setAccessibilityFocus(handle); }} accessibilityRole="header" style={[t.type.whyteLg, { color: t.color.txPrimary }]}>{reference.name}</Text>
    {star ? <View style={{ backgroundColor: t.color.bgSolidCard, borderRadius: t.radius.md, padding: t.space.lg, gap: t.space.lg }}>
      {[['Designation', star.displayDesignation || 'Unavailable'], ['Constellation', star.constellation || 'Unavailable'], ['Magnitude', star.magnitude.toFixed(2)]].map(([label, value]) => <View key={label} style={{ gap: 6 }}><Text style={[t.type.whyteXs, { color: t.color.txSecondary }]}>{label}</Text><Text style={[label === 'Magnitude' ? t.type.fraktionSm : t.type.whyteSm, { color: t.color.txPrimary }]}>{value}</Text></View>)}
      <View style={{ gap: 8 }}><Text style={[t.type.whyteXs, { color: t.color.txSecondary }]}>Reference position · {star.sign}</Text><StarPosition star={star} /></View>
    </View> : <Text style={[t.type.whyteSm, { color: t.color.txSecondary }]}>{loading ? 'Loading catalog details…' : catalogError ? 'Couldn’t load the star catalog. Your saved reference is preserved; retry to load its details.' : 'Details are unavailable in the loaded catalog. Your saved reference remains in your library until you remove it.'}</Text>}
    <Text style={[t.type.whyteXs, { color: t.color.txSecondary }]}>Tropical reference · 1 Jan 2000, 12:00 UTC. Chart positions use each chart’s date and zodiac system.</Text>
    {(star || selected) && <StarAction label={selected ? 'Remove from my stars' : 'Add to my stars'} disabled={!ready} onPress={onToggle} />}
    {catalogError && <StarAction label="Retry star catalog" onPress={onRetryCatalog} />}
    {saveError && <StarAction label="Retry saving star changes" onPress={onRetrySave} />}
    <Text accessibilityLiveRegion="polite" style={[t.type.whyteXs, { color: t.color.txSecondary }]}>{status}</Text>
  </ScrollView>;
}
