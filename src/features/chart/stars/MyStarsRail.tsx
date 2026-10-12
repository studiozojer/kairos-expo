import type { Ref } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useTheme } from '@/theme';
import type { StarReference } from './library';
import { StarIcon } from './StarControls';
export function StarChip({ star, disabled, onDetails, onRemove, detailsRef }: { star: StarReference; disabled: boolean; onDetails: () => void; onRemove: () => void; detailsRef?: Ref<View> }) {
  const t = useTheme();
  return <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: t.color.bgSolidCardSecondary, borderWidth: t.border.hairline, borderColor: t.color.bdCard, borderRadius: t.radius.full }}>
    <Pressable ref={detailsRef} accessibilityRole="button" accessibilityLabel={`Inspect ${star.name}`} accessibilityHint="Opens star details" onPress={onDetails} style={({ pressed }) => ({ minHeight: 44, paddingLeft: 14, paddingRight: 4, justifyContent: 'center', opacity: pressed ? .5 : 1 })}><Text style={[t.type.whyteXs, { color: t.color.txPrimary }]}>{star.name}</Text></Pressable>
    <Pressable disabled={disabled} accessibilityRole="button" accessibilityLabel={`Remove ${star.name}`} accessibilityState={{ disabled }} onPress={onRemove} style={({ pressed }) => ({ minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center', opacity: disabled || pressed ? .5 : 1 })}><StarIcon name="close" size={16} color={t.color.txSecondary} /></Pressable>
  </View>;
}
export function MyStarsRail({ stars, disabled, onDetails, onRemove, detailsRef }: { stars: StarReference[]; disabled: boolean; onDetails: (star: StarReference) => void; onRemove: (id: string) => void; detailsRef: (id: string) => Ref<View> }) {
  const t = useTheme();
  return <View style={{ gap: 8, paddingVertical: 8 }}>
    <Text accessibilityRole="header" style={[t.type.whyteSm, { color: t.color.txPrimary }]}>My stars <Text style={{ color: t.color.txSecondary }}>· {stars.length}</Text></Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8, alignItems: 'center', minHeight: 44 }}>
      {stars.map(star => <StarChip key={star.id} star={star} disabled={disabled} onDetails={() => onDetails(star)} onRemove={() => onRemove(star.id)} detailsRef={detailsRef(star.id)} />)}
      {!stars.length && <Text style={[t.type.whyteXs, { color: t.color.txSecondary, paddingVertical: 14 }]}>Choose stars from the catalog to build your library.</Text>}
    </ScrollView>
  </View>;
}
