import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';
import { buildConfiguration } from '@/features/chart/config/buildConfiguration';
import { useChartTime } from '@/features/chart/time/ChartTimeContext';
import { hasNativeTimeAccessory, TimeStepper } from '@/features/chart/time/TimeStepper';
import { SettingsSheet } from '@/features/chart/settings/SettingsSheet';
import { DisplaySheet } from '@/features/chart/display/DisplaySheet';
import { bodyChoices } from '@/features/chart/display/displayPreset';
import { bundledPreset, bundledPresetSource } from '@/features/chart/display/presets';
import { ChartWheel } from '@/features/chart/render/ChartWheel';
import { presetDocument, editPresetDocument } from '@/features/chart/display/presetDocument';

/** A locally calculated, stepped chart with an in-memory display editor. The source
 * document retains fields owned by other consumers; its projection feeds rendering. */
export default function ChartHome() {
  const theme = useTheme();
  const { settings, loaded, update, saveError, result, status, retry } = useChartTime();
  const chart = result?.chart;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [document, setDocument] = useState(() => presetDocument(bundledPresetSource('classic')));
  const preset = document.preset;
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
    setDocument(presetDocument(bundledPresetSource(name)));
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
        <Pressable accessibilityRole="button" accessibilityLabel="Chart settings" disabled={!loaded} onPress={() => setSettingsOpen(true)}
          style={{ minHeight: 44, justifyContent: 'center' }}>
          <Text style={[theme.type.whyteSm, { color: theme.color.txAccent }]}>Settings</Text>
        </Pressable>
        <Text numberOfLines={1} style={[theme.type.fraktionXxs, { color: theme.color.txAccent, flex: 1, textAlign: 'center', marginHorizontal: theme.space.sm }]}>
          {(result?.settings ?? settings).location.name}
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
        {result && <Text style={[theme.type.fraktionXxs, { color: theme.color.txAccent }]}>
          {new Date(result.datetime).toLocaleString('en-US', { timeZone: result.settings.location.timezone, year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}
        </Text>}
        {result && status === 'error' && <Pressable accessibilityRole="button" onPress={retry} style={{ padding: theme.space.md }}>
          <Text accessibilityRole="alert" style={[theme.type.whyteSm, { color: theme.color.txAccent }]}>Couldn’t update the chart. Retry</Text>
        </Pressable>}
      </View>

      {!hasNativeTimeAccessory && <View style={{ marginHorizontal: theme.space.lg, marginBottom: insets.bottom + theme.space.sm,
        borderRadius: theme.radius.full, backgroundColor: theme.color.bgSolidBase, borderWidth: theme.border.hairline,
        borderColor: theme.color.txTertiary }}><TimeStepper /></View>}

      <SettingsSheet visible={settingsOpen} settings={settings} saveError={saveError} onChange={update} onClose={() => setSettingsOpen(false)} />
      {config && <DisplaySheet
        visible={sheetOpen}
        preset={preset}
        presetName={presetName}
        bodyNames={bodyNames}
        onSelectPreset={selectPreset}
        config={config}
        onChangePreset={next => setDocument(current => editPresetDocument(current, next))}
        onClose={() => setSheetOpen(false)}
      />}
    </View>
  );
}
