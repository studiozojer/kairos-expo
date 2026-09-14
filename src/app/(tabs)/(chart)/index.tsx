import { useMemo, useState } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';
import { buildConfiguration } from '@/features/chart/config/buildConfiguration';
import type { ChartCalculationResponse } from '@/features/chart/config/engine-types';
import chart from '@/features/chart/fixtures/engine/sibly-1776.json';
import { DisplaySheet } from '@/features/chart/display/DisplaySheet';
import { bodyChoices } from '@/features/chart/display/displayPreset';
import { bundledPreset } from '@/features/chart/display/presets';
import { ChartWheel } from '@/features/chart/render/ChartWheel';
import type { Preset } from '@/features/chart/schema/preset';

/**
 * The chart tab — the interactive experience users know, ported deliberately.
 *
 * Stage 1 premise slice: the Skia wheel shell (Task 8) over the canned
 * sibly-1776 engine response + the classic preset. Chart data plumbing
 * (live engine, time scrubbing) is deliberately not here yet.
 *
 * The Display sheet (fork B of the athanor's chart-wheel fork) makes the
 * wheel's style/visibility editable in memory: pick a bundled preset, toggle
 * rings/bodies/aspects. The preset is the single source of truth — each edit
 * rebuilds the config and the wheel re-renders. Nothing persists yet (no vault);
 * that is a later, separate step (the direction note's "preset picker" + a few
 * dials, proven on device before any engine wiring).
 */
export default function ChartHome() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [preset, setPreset] = useState<Preset>(() => bundledPreset('classic')!.preset);
  const [presetName, setPresetName] = useState('classic');
  const [sheetOpen, setSheetOpen] = useState(false);

  const bodyNames = useMemo(() => bodyChoices(chart as ChartCalculationResponse), []);

  // PINNED (do not inline): buildConfiguration returns a fresh object per
  // call, and ChartWheel's layout memo keys on config identity — an unpinned
  // config re-lays-out every render. Keyed on the editable preset so the sheet
  // drives a live re-render without a route change.
  const config = useMemo(
    () => buildConfiguration(chart as ChartCalculationResponse, preset),
    [preset],
  );

  const selectPreset = (name: string) => {
    const next = bundledPreset(name);
    if (!next) return;
    setPreset(next.preset);
    setPresetName(name);
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.color.bgSolidBase }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'flex-end',
          paddingHorizontal: theme.space.lg,
          paddingTop: insets.top + theme.space.sm,
        }}>
        <Pressable onPress={() => setSheetOpen(true)} hitSlop={8}>
          <Text style={[theme.type.whyteSm, { color: theme.color.txAccent }]}>Display</Text>
        </Pressable>
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ChartWheel config={config} size={width} />
      </View>

      <DisplaySheet
        visible={sheetOpen}
        preset={preset}
        presetName={presetName}
        bodyNames={bodyNames}
        onSelectPreset={selectPreset}
        onChangePreset={setPreset}
        onClose={() => setSheetOpen(false)}
      />
    </View>
  );
}
