import { SheetHeader } from '../components/ChartSheet';
import { MenuView } from '@react-native-menu/menu';
import { BUNDLED_PRESET_NAMES } from './presets';
import { Text, View, type ViewProps } from 'react-native';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { useTheme } from '@/theme';

const CHEVRON = Skia.Path.MakeFromSVGString('M5 8L10 13L15 8')!;

function HeaderIcon({ color }: { color: string }) {
  return <Canvas pointerEvents="none" style={{ width: 20, height: 20 }}>
    <Path path={CHEVRON} color={color} style="stroke" strokeWidth={1.5} strokeCap="round" strokeJoin="round" />
  </Canvas>;
}

/** Native anchored menu; selecting a preset leaves the editor page in place. */
export function PresetSelector({ name, onSelect }: { name: string; onSelect: (name: string) => void }) {
  const t = useTheme();
  const label = name.charAt(0).toUpperCase() + name.slice(1);
  // MenuView forwards these ViewProps to its native host; its public types omit them.
  const accessibility: Pick<ViewProps, 'accessible' | 'accessibilityRole' | 'accessibilityLabel' | 'accessibilityHint'> = {
    accessible: true, accessibilityRole: 'button', accessibilityLabel: `Display preset: ${label}`,
    accessibilityHint: 'Choose a display preset',
  };
  return <MenuView title="Display preset" {...accessibility} shouldOpenOnLongPress={false} isAnchoredToRight
    themeVariant={t.scheme}
    actions={BUNDLED_PRESET_NAMES.map(key => ({
      id: key, title: key.charAt(0).toUpperCase() + key.slice(1),
      state: key === name ? 'on' : 'off',
    }))}
    onPressAction={({ nativeEvent: { event } }) => {
      if (event !== name && BUNDLED_PRESET_NAMES.includes(event)) onSelect(event);
    }}
    style={{ minHeight: 44, minWidth: 44, maxWidth: '100%', justifyContent: 'center' }}>
    <View pointerEvents="none" style={{
      minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: t.space.xs,
      paddingStart: t.space.md, paddingEnd: t.space.sm,
      borderRadius: t.radius.full, borderWidth: t.border.thin, borderColor: t.color.bdCard,
      backgroundColor: t.color.bgSolidCardSecondary,
    }}>
      <Text numberOfLines={1} style={[t.type.whyteXs, { color: t.color.txPrimary, flexShrink: 1 }]}>{label}</Text>
      <HeaderIcon color={t.color.txSecondary} />
    </View>
  </MenuView>;
}

export function DisplayHeader({ presetName, onClose, onSelectPreset }: {
  presetName: string; onClose: () => void; onSelectPreset: (name: string) => void;
}) {
  return <SheetHeader title="Display" closeLabel="Close display settings" onClose={onClose}
    trailing={<PresetSelector name={presetName} onSelect={onSelectPreset} />} />;
}
