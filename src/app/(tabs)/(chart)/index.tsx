import { useMemo, useState } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';
import { buildConfiguration } from '@/features/chart/config/buildConfiguration';
import type { ChartCalculationResponse } from '@/features/chart/config/engine-types';
import chart from '@/features/chart/fixtures/engine/sibly-1776.json';
import { DisplaySheet } from '@/features/chart/display/DisplaySheet';
import { bodyChoices } from '@/features/chart/display/displayPreset';
import { bundledPreset, bundledPresetSource } from '@/features/chart/display/presets';
import { ChartWheel } from '@/features/chart/render/ChartWheel';
import { presetDocument, editPresetDocument } from '@/features/chart/display/presetDocument';

/** The fixture-backed chart and its live, in-memory display editor. The source
 * document retains fields owned by other consumers; the parsed projection feeds
 * rendering. Navigation and preview state are separate from preset data. */
export default function ChartHome() {
  const theme = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [document, setDocument] = useState(() => presetDocument(bundledPresetSource('classic')));
  const preset = document.preset;
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
    setDocument(presetDocument(bundledPresetSource(name)));
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
        config={config}
        onChangePreset={next => setDocument(current => editPresetDocument(current, next))}
        onClose={() => setSheetOpen(false)}
      />
    </View>
  );
}
