import { Pressable, View } from 'react-native';
import { Canvas } from '@shopify/react-native-skia';
import { useTheme } from '@/theme';
import type { ChartColors } from '../schema/core-types';
import { CELESTIAL_BODIES } from '../schema/enums.gen';
import { Glyph } from '../render/Glyph';
import type { GlyphName } from '../render/glyph-map.gen';
import { resolveColorValue } from '../render/colors';

const PLANET_IDS = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'] as const;
export const PLANET_NAMES = PLANET_IDS.map(id => CELESTIAL_BODIES[id].displayName);

/** Chart-specific glyph toggles, matching kairos-ios PlanetToggleButton.
 * Pressable supplies touch/accessibility behavior; daoUI colors supply the surface. */
export function PlanetPicker({ enabledBodies, colors, onToggle }: {
  enabledBodies: readonly string[]; colors: ChartColors; onToggle: (name: string) => void;
}) {
  const t = useTheme();
  return <View style={{ gap: t.space.md }}>
    {[PLANET_IDS.slice(0, 5), PLANET_IDS.slice(5)].map((row, index) =>
      <View key={index} style={{ flexDirection: 'row', gap: t.space.md }}>
        {row.map(id => {
          const body = CELESTIAL_BODIES[id];
          const enabled = enabledBodies.includes(body.displayName);
          const hue = colors.celestialBodyColors.planetHues[id];
          const color = (layer: 'bg' | 'bd' | 'ic') => resolveColorValue({ source: 'hue', value: hue, layer }, t);
          return <Pressable key={id} accessibilityRole="checkbox" accessibilityLabel={body.displayName}
            accessibilityState={{ checked: enabled }} onPress={() => onToggle(body.displayName)}
            style={({ pressed }) => ({
              flex: 1, height: 56, borderRadius: t.radius.md,
              borderWidth: t.border.thin,
              backgroundColor: enabled ? color('bg') : t.color.bgSolidButtonDisabled,
              borderColor: enabled ? color('bd') : t.color.bdSecondary,
              alignItems: 'center', justifyContent: 'center', opacity: pressed ? .7 : 1,
            })}>
            <Canvas pointerEvents="none" style={{ width: 28, height: 28 }}>
              <Glyph name={`celestials/${body.glyphAsset}` as GlyphName} x={14} y={14} size={28}
                color={enabled ? color('ic') : t.color.icTertiary} />
            </Canvas>
          </Pressable>;
        })}
      </View>) }
  </View>;
}
