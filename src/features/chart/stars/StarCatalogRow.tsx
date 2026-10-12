import { memo, type Ref } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { Canvas } from '@shopify/react-native-skia';
import { useTheme } from '@/theme';
import { Glyph } from '../render/Glyph';
import { GLYPH_ASSETS, type GlyphName } from '../render/glyph-map.gen';
import { referencePosition, type CatalogStar } from './catalog';
import { StarIcon } from './StarControls';
export function StarPosition({ star }: { star: CatalogStar }) {
  const t = useTheme();
  const { fontScale } = useWindowDimensions();
  const size = 18 * fontScale;
  const name = `signs/${star.sign.toLowerCase()}` as GlyphName;
  return <View accessible accessibilityLabel={referencePosition(star)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
    <Text style={[t.type.fraktionXs, { color: t.color.txSecondary, textAlign: 'right', minWidth: 30 * fontScale }]}>{star.degrees}°</Text>
    {name in GLYPH_ASSETS ? <Canvas pointerEvents="none" style={{ width: size, height: size }}><Glyph name={name} size={size} x={size / 2} y={size / 2} color={t.color.txSecondary} /></Canvas> : <Text style={[t.type.whyteXs, { color: t.color.txSecondary }]}>{star.sign}</Text>}
    <Text style={[t.type.fraktionXs, { color: t.color.txSecondary }]}>{String(star.minutes).padStart(2, '0')}′</Text>
  </View>;
}
export const StarCatalogRow = memo(function StarCatalogRow({ star, selected, disabled, onToggle, onDetails, infoRef }: {
  star: CatalogStar; selected: boolean; disabled: boolean; onToggle: () => void; onDetails: () => void; infoRef?: Ref<View>;
}) {
  const t = useTheme();
  const { width, fontScale } = useWindowDimensions();
  const reflow = width < 350 || fontScale > 1.2;
  return <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: t.color.bgSolidCard, borderRadius: t.radius.md, borderWidth: t.border.hairline, borderColor: selected ? t.color.bdPrimary : t.color.bdCard, marginBottom: t.space.xs }}>
    <Pressable accessibilityRole="checkbox" accessibilityLabel={`${selected ? 'Remove' : 'Add'} ${star.name}`} accessibilityHint={`${star.displayDesignation}, ${star.constellation}. Magnitude ${star.magnitude.toFixed(2)}. Reference ${referencePosition(star)}.`} accessibilityState={{ checked: selected, disabled }} disabled={disabled} onPress={onToggle} style={({ pressed }) => ({ flex: 1, paddingVertical: 12, paddingLeft: 12, opacity: pressed || disabled ? .6 : 1, flexDirection: 'row', alignItems: 'center', gap: 12 })}>
      <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: selected ? t.color.txAccent : t.color.bdPrimary, backgroundColor: selected ? t.color.bgSolidCardSecondary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>{selected && <StarIcon name="check" color={t.color.txAccent} />}</View>
      <View style={{ flex: 1, gap: 6 }}>
        <View style={{ flexDirection: reflow ? 'column' : 'row', alignItems: reflow ? 'flex-start' : 'center', gap: 8 }}>
          <Text style={[t.type.whyteSm, { color: t.color.txPrimary, flex: reflow ? undefined : 1, flexShrink: 1 }]}>{star.name}</Text>
          <StarPosition star={star} />
        </View>
        <Text style={[t.type.whyteXs, { color: t.color.txSecondary }]}>{[star.displayDesignation, star.constellation].filter(Boolean).join(' · ')}</Text>
        <Text style={[t.type.fraktionXs, { color: t.color.txSecondary }]}>mag {star.magnitude.toFixed(2)}</Text>
      </View>
    </Pressable>
    <Pressable ref={infoRef} accessibilityRole="button" accessibilityLabel={`Details for ${star.name}`} onPress={onDetails} style={({ pressed }) => ({ width: 44, minHeight: 52, alignItems: 'center', justifyContent: 'center', opacity: pressed ? .5 : 1 })}><StarIcon name="info" color={t.color.txSecondary} /></Pressable>
  </View>;
});
