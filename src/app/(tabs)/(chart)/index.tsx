import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useIsFocused } from 'expo-router';
import { useCardDragSession } from '@/features/chart/active/useCardDragSession';
import { ChartPutAwayOverlay } from '@/features/chart/active/ChartPutAwayOverlay';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';
import { useActiveConfiguration } from '@/features/chart/active/useActiveConfiguration';
import { useChartTime } from '@/features/chart/time/ChartTimeContext';
import { ActiveChartCards } from '@/features/chart/active/ActiveChartCards';
import { useActiveCharts } from '@/features/chart/active/ActiveChartsContext';
import { TimeStepper } from '@/features/chart/time/TimeStepper';
import { TimeStepperSurface } from '@/features/chart/time/TimeStepperSurface';
import { SettingsSheet } from '@/features/chart/settings/SettingsSheet';
import { DisplaySheet } from '@/features/chart/display/DisplaySheet';
import { toggleBody, bodyChoices } from '@/features/chart/display/displayPreset';
import { bundledPreset, bundledPresetSource } from '@/features/chart/display/presets';
import { InteractiveChartWheel } from '@/features/chart/interaction/InteractiveChartWheel';
import { presetDocument, editPresetDocument } from '@/features/chart/display/presetDocument';

/** One wheel composes the persisted open session; the glass controls address
 * its explicit target. Keep every ring in place while its next result computes. */
export default function ChartHome() {
  const theme = useTheme();
  const { settings, loaded, update, saveError } = useChartTime();
  const session = useActiveCharts();
  const failed = session.active.filter(item => session.calculations[item.id]?.status === 'error');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const window = useWindowDimensions();
  const [viewport, setViewport] = useState({ width: window.width, height: window.height });
  const { width } = viewport;
  const screen = useRef<View>(null);
  const focused = useIsFocused();
  const [windowRect, setWindowRect] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [stepperTop, setStepperTop] = useState(window.height);
  const [chartArea, setChartArea] = useState({ y: 0, height: 0 });
  const chartHeight = chartArea.height;
  const [wheelY, setWheelY] = useState(0);
  const wheelSize = Math.min(width, Math.max(0, chartHeight - (failed.length > 0 ? 104 : 60)));
  const insets = useSafeAreaInsets();

  const [document, setDocument] = useState(() => presetDocument(bundledPresetSource('classic')));
  const preset = document.preset;
  const [presetName, setPresetName] = useState('classic');
  const [sheetOpen, setSheetOpen] = useState(false);
  const cardDrag = useCardDragSession({ ids: session.active.map(chart => chart.id), viewport: windowRect, enabled: focused && !sheetOpen && !settingsOpen,
    onDrop: drop => { if (drop.kind === 'remove') session.remove(drop.id); else session.moveTo(drop.id, drop.targetId); } });

  const bodyNames = useMemo(() => [...new Set(session.active.flatMap(item => {
    const calculation = session.calculations[item.id]?.result;
    return calculation ? bodyChoices(calculation.chart) : [];
  }))].sort(), [session.active, session.calculations]);

  const { config, previousArrangement } = useActiveConfiguration(session.active, session.calculations, preset);

  const selectPreset = (name: string) => {
    const next = bundledPreset(name);
    if (!next) return;
    setDocument(presetDocument(bundledPresetSource(name)));
    setPresetName(name);
  };

  return (
    <View ref={screen} onLayout={event => {
      const { width, height } = event.nativeEvent.layout; setViewport({ width, height });
      cardDrag.invalidate();
      screen.current?.measureInWindow((x, y, width, height) => setWindowRect({ x, y, width, height }));
    }}
      style={{ flex: 1, backgroundColor: theme.color.bgSolidBase }}>
      {/* The canvas fills the screen; the measured slot below locates the wheel
          without clipping it. Cards and the stepper bound the resting slot. */}
      {config && wheelSize > 0 && <InteractiveChartWheel config={config} size={wheelSize} viewport={viewport}
        baseCenter={{ x: width / 2, y: chartArea.y + wheelY + wheelSize / 2 }}
        selectionStyle={preset.selection} enabled={!sheetOpen && !settingsOpen && !previousArrangement}
        onHideBody={name => setDocument(current => editPresetDocument(current, toggleBody(current.preset, name, false)))} />}
      <View pointerEvents="box-none"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: theme.space.lg,
          paddingTop: insets.top + theme.space.sm,
        }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Chart settings" disabled={!loaded || !session.targetId} onPress={() => setSettingsOpen(true)}
          style={{ minHeight: 44, justifyContent: 'center' }}>
          <Text style={[theme.type.whyteSm, { color: theme.color.txAccent }]}>Chart settings</Text>
        </Pressable>
        <Text numberOfLines={1} style={[theme.type.fraktionXxs, { color: theme.color.txAccent, flex: 1, textAlign: 'center', marginHorizontal: theme.space.sm }]}>
          {session.active.find(item => item.id === session.targetId)?.name ?? 'Chart'}
        </Text>
        <Pressable accessibilityRole="button" disabled={!config || previousArrangement} onPress={() => setSheetOpen(true)} hitSlop={8}>
          <Text style={[theme.type.whyteSm, { color: theme.color.txAccent }]}>Display</Text>
        </Pressable>
      </View>

      <ActiveChartCards session={cardDrag} />
      {(session.loadError || session.saveError) && <Pressable accessibilityRole="button"
        onPress={session.loadError ? session.retryLoad : session.retryPersistence} style={{ paddingHorizontal: theme.space.lg, paddingVertical: theme.space.sm }}>
        <Text accessibilityRole="alert" style={[theme.type.whyteXs, { color: theme.color.txAccent }]}>
          {session.loadError ? 'Couldn’t restore charts. Tap to retry; stored charts have not been replaced.' : 'Changes haven’t been saved on this device. Tap to retry.'}
        </Text>
      </Pressable>}
      {previousArrangement && <Text accessibilityRole="alert" style={[theme.type.whyteXxs, { color: theme.color.txSecondary, paddingHorizontal: theme.space.lg }]}>
        Showing the previous wheel arrangement until all open charts calculate.
      </Text>}
      <View pointerEvents="box-none" onLayout={event => { const { y, height } = event.nativeEvent.layout; setChartArea({ y, height }); }} style={{ flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'center' }}>
        {config && wheelSize > 0 ? <View pointerEvents="none" onLayout={event => setWheelY(event.nativeEvent.layout.y)}
          style={{ width: wheelSize, height: wheelSize + 44 }} /> : failed.length > 0 ? (
          <View style={{ alignItems: 'center', gap: theme.space.md }}>
            <Text accessibilityRole="alert" style={[theme.type.whyteSm, { color: theme.color.txAccent }]}>
              Couldn’t load {failed.map(item => item.name).join(', ')}.
            </Text>
            <Pressable accessibilityRole="button" onPress={() => failed.forEach(item => session.calculations[item.id]?.retry())} hitSlop={12}>
              <Text style={[theme.type.whyteSm, { color: theme.color.txAccent }]}>Retry</Text>
            </Pressable>
          </View>
        ) : config ? <Text style={[theme.type.whyteXs, { color: theme.color.txSecondary }]}>Hide chart cards to make room for the wheel.</Text> : session.loaded && session.active.length === 0 ? <Text style={[theme.type.whyteSm, { color: theme.color.txSecondary }]}>Add a saved chart or current transits to begin.</Text>
          : !session.loadError ? <ActivityIndicator accessibilityLabel="Calculating open charts" color={theme.color.txAccent} /> : null}
        {config && failed.length > 0 && <Pressable accessibilityRole="button"
          onPress={() => failed.forEach(item => session.calculations[item.id]?.retry())} style={{ padding: theme.space.md }}>
          <Text accessibilityRole="alert" style={[theme.type.whyteXs, { color: theme.color.txAccent }]}>Showing previous positions for {failed.map(item => item.name).join(', ')}. Retry</Text>
        </Pressable>}
      </View>

      <View onLayout={event => setStepperTop(event.nativeEvent.layout.y)} style={{ marginHorizontal: theme.space.lg, marginBottom: insets.bottom + theme.space.sm }}>
        <TimeStepperSurface><TimeStepper key={session.targetId ?? 'empty'} /></TimeStepperSurface>
      </View>

      <ChartPutAwayOverlay session={cardDrag} stepperTop={stepperTop} />
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
