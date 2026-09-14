import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';
import { buildConfiguration } from '@/features/chart/config/buildConfiguration';
import { useLoadTimeChart } from '@/features/chart/data/useLoadTimeChart';
import { DEFAULT_LOCATION } from '@/features/chart/data/calculateChart';
import { DisplaySheet } from '@/features/chart/display/DisplaySheet';
import { bodyChoices } from '@/features/chart/display/displayPreset';
import { bundledPreset } from '@/features/chart/display/presets';
import { ChartWheel } from '@/features/chart/render/ChartWheel';
import type { Preset } from '@/features/chart/schema/preset';

/** A single Seattle transit chart captured when this screen mounts. */
export default function ChartHome() {
  const theme = useTheme();
  const { chart, status, retry, datetime } = useLoadTimeChart();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [preset, setPreset] = useState<Preset>(() => bundledPreset('classic')!.preset);
  const [presetName, setPresetName] = useState('classic');
  const [sheetOpen, setSheetOpen] = useState(false);

  const bodyNames = useMemo(() => chart ? bodyChoices(chart) : [], [chart]);

  // PINNED (do not inline): buildConfiguration returns a fresh object per
  // call, and ChartWheel's layout memo keys on config identity — an unpinned
  // config re-lays-out every render. Keyed on the editable preset so the sheet
  // drives a live re-render without a route change.
  const config = useMemo(
    () => chart ? buildConfiguration(chart, preset) : undefined,
    [chart, preset],
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
          justifyContent: 'space-between',
          paddingHorizontal: theme.space.lg,
          paddingTop: insets.top + theme.space.sm,
        }}>
        <Text style={[theme.type.fraktionXxs, { color: theme.color.txAccent }]}>
          {DEFAULT_LOCATION.name}
        </Text>
        <Pressable accessibilityRole="button" disabled={!chart} onPress={() => setSheetOpen(true)} hitSlop={8}>
          <Text style={[theme.type.whyteSm, { color: theme.color.txAccent }]}>Display</Text>
        </Pressable>
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        {config ? <ChartWheel config={config} size={width} /> : status === 'error' ? (
          <View style={{ alignItems: 'center', gap: theme.space.md }}>
            <Text accessibilityRole="alert" style={[theme.type.whyteSm, { color: theme.color.txAccent }]}>
              Couldn’t load the chart.
            </Text>
            <Pressable accessibilityRole="button" onPress={retry} hitSlop={12}>
              <Text style={[theme.type.whyteSm, { color: theme.color.txAccent }]}>Retry</Text>
            </Pressable>
          </View>
        ) : <ActivityIndicator accessibilityLabel="Loading current transits" color={theme.color.txAccent} />}
        {chart && <Text style={[theme.type.fraktionXxs, { color: theme.color.txAccent }]}>
          {new Date(datetime).toLocaleString('en-US', { timeZone: DEFAULT_LOCATION.timezone, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}
        </Text>}
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
