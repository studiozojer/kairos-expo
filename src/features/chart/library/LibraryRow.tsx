import { MenuView } from '@react-native-menu/menu';
import { Platform, Pressable, Text, View, type ViewProps } from 'react-native';
import { useTheme } from '@/theme';
import type { SavedChart } from '../active/model';
import { LibraryIcon } from './LibraryIcon';
import { rowDate } from './browse';

export type LibraryRowAction = 'favorite' | 'edit' | 'duplicate' | 'delete';
export function LibraryRow({ chart, onOpen, onAction }: { chart: SavedChart; onOpen: () => void; onAction: (action: LibraryRowAction) => void }) {
  const t = useTheme();
  const date = rowDate(chart.datetime, chart.settings.location.timezone);
  const favorite = !!chart.metadata?.favorite;
  const accessibility: Pick<ViewProps, 'accessible' | 'accessibilityRole' | 'accessibilityLabel'> = { accessible: true, accessibilityRole: 'button', accessibilityLabel: `More options for ${chart.name}` };
  return <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, borderBottomWidth: .5, borderBottomColor: t.color.bdSecondary }}>
    <Pressable accessibilityRole="button" accessibilityLabel={`Open ${chart.name}`} accessibilityHint={`${date.date}, ${date.time} ${date.offset}. ${chart.settings.location.name}`}
      onPress={onOpen} style={({ pressed }) => ({ flex: 1, minHeight: 56, paddingVertical: 4, flexDirection: 'row', alignItems: 'center', backgroundColor: pressed ? t.color.bgPressed : 'transparent', borderRadius: 6 })}>
      <View style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
        <Text numberOfLines={1} style={[t.type.whyteSm, { color: t.color.txSecondary }]}>{chart.name}</Text>
        <Text numberOfLines={1} style={[t.type.whyteXs, { color: t.color.txTertiary }]}>{chart.settings.location.name}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={[t.type.whyteSm, { color: t.color.txSecondary }]}>{date.date}</Text>
        <Text numberOfLines={1} style={[t.type.whyteXs, { color: t.color.txTertiary }]}>{date.time} <Text style={{ color: t.color.txDisabled }}>{date.offset}</Text></Text>
      </View>
    </Pressable>
    {favorite && <Pressable accessibilityRole="button" accessibilityLabel={`Remove ${chart.name} from favorites`} onPress={() => onAction('favorite')}
      style={({ pressed }) => ({ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: pressed ? .6 : 1 })}>
      <LibraryIcon name="star" color={t.color.txWarning} />
    </Pressable>}
    <MenuView {...accessibility} title={chart.name} themeVariant={t.scheme} shouldOpenOnLongPress={false} isAnchoredToRight
      actions={[
        { id: 'favorite', title: favorite ? 'Remove favorite' : 'Add favorite', image: Platform.OS === 'ios' ? (favorite ? 'star.slash' : 'star') : undefined },
        { id: 'edit', title: 'Edit', image: Platform.OS === 'ios' ? 'pencil' : undefined },
        { id: 'duplicate', title: 'Duplicate', image: Platform.OS === 'ios' ? 'doc.on.doc' : undefined },
        { id: 'delete', title: 'Delete', attributes: { destructive: true }, image: Platform.OS === 'ios' ? 'trash' : undefined },
      ]} onPressAction={({ nativeEvent: { event } }) => { if (['favorite', 'edit', 'duplicate', 'delete'].includes(event)) onAction(event as LibraryRowAction); }}
      style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
      <LibraryIcon name="more" color={t.color.icSecondary} />
    </MenuView>
  </View>;
}
