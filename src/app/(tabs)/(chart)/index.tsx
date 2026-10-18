import { useContextualTips } from '@/features/tips/ContextualTips';
import { useStarLibrary } from '@/features/chart/stars/useStarLibrary';
import { rotateOrientation, resetOrientation } from '@/features/chart/interaction/orientation';
import { wheelFrame } from '@/features/chart/interaction/wheelFrame';
import { ReplacementChooser } from '@/features/chart/active/ReplacementChooser';
import { useActionRegistry } from '@/features/chart/actions/useActionRegistry';
import { useMemo, useRef, useState } from 'react';
import { Alert, ActivityIndicator, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useIsFocused, useRouter } from 'expo-router';
import { useCardDragSession } from '@/features/chart/active/useCardDragSession';
import { ChartPutAwayOverlay } from '@/features/chart/active/ChartPutAwayOverlay';
import { MarkingMenuProvider } from '@/features/chart/marking/MarkingMenu';
import { ChartToolbar } from '@/features/chart/marking/ChartToolbar';
import { useChartScreenshot } from '@/features/chart/marking/useChartScreenshot';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';
import { useActiveConfiguration } from '@/features/chart/active/useActiveConfiguration';
import { useChartTime } from '@/features/chart/time/ChartTimeContext';
import { ActiveChartCards } from '@/features/chart/active/ActiveChartCards';
import { useActiveCharts } from '@/features/chart/active/ActiveChartsContext';
import { SelectionStepper } from '@/features/chart/events/SelectionStepper';
import { starRingGuidance, type StarRingTarget } from '@/features/chart/stars/ringContext';
import { SettingsSheet } from '@/features/chart/settings/SettingsSheet';
import { DisplaySheet, DisplayEditor } from '@/features/chart/display/DisplaySheet';
import { toggleBody, bodyChoices } from '@/features/chart/display/displayPreset';
import { useDisplayPresets } from '@/features/chart/display/useDisplayPresets';
import { renderingPreset, applyAppearance, type ChartCount } from '@/features/chart/display/model';
import { displayTemplate } from '@/features/chart/display/templates';
import type { Preset } from '@/features/chart/schema/preset';
import { InteractiveChartWheel } from '@/features/chart/interaction/InteractiveChartWheel';


/** One wheel composes the persisted open session; the glass controls address
 * its explicit target. Keep every ring in place while its next result computes. */
export default function ChartHome() {
  const theme = useTheme();
  const router = useRouter();
  const [replaceNow, setReplaceNow] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const clock = useChartTime();
  const { settings, loaded, update, saveError } = clock;
  const session = useActiveCharts();
  const failed = session.active.filter(item => session.calculations[item.id]?.status === 'error');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTargetId, setSettingsTargetId] = useState<string>();
  const [settingsRings, setSettingsRings] = useState<StarRingTarget>();
  const [settingsPreview, setSettingsPreview] = useState<number | null>(0);
  const window = useWindowDimensions();
  const [viewport, setViewport] = useState({ width: window.width, height: window.height });
  const { width } = viewport;
  const screen = useRef<View>(null);
  const focused = useIsFocused();
  const [menuActive, setMenuActive] = useState(false);

  const { capturing, capture } = useChartScreenshot(screen);
  const [windowRect, setWindowRect] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [stepperTop, setStepperTop] = useState(window.height);
  const [chartArea, setChartArea] = useState({ y: 0, height: 0 });
  const { size: wheelSize, center: wheelCenter } = wheelFrame(width, chartArea, failed.length > 0);
  const insets = useSafeAreaInsets();

  const stars = useStarLibrary();
  const display = useDisplayPresets();
  const localPreset = display.preset;
  const preset = useMemo(() => renderingPreset(localPreset), [localPreset]);
  const presetName = localPreset.name;
  const orientationMode = localPreset.orientation.mode;
  const changePreset = (next: Preset) => { void display.update(applyAppearance(display.preset,next)); };
  const [sheetOpen, setSheetOpen] = useState(false);
  const tips = useContextualTips();
  const cardDrag = useCardDragSession({ ids: session.active.map(chart => chart.id), viewport: windowRect, enabled: focused && !sheetOpen && !settingsOpen && !replaceNow && !menuActive && !capturing,
    onDrop: drop => { tips.dismiss('dragChartCard'); if (drop.kind === 'remove') session.remove(drop.id); else session.moveTo(drop.id, drop.targetId); } });

  const bodyNames = useMemo(() => [...new Set(session.active.flatMap(item => {
    const calculation = session.calculations[item.id]?.result;
    return calculation ? bodyChoices(calculation.chart) : [];
  }))].sort(), [session.active, session.calculations]);

  const { config, previousArrangement } = useActiveConfiguration(session.active, session.calculations, preset, orientationMode, stars.names);

  const actions = useActionRegistry({
    enabled: focused && !sheetOpen && !settingsOpen && !replaceNow && !capturing,
    settingsEnabled: loaded && !!session.targetId, chartEnabled: display.state.loaded && !!config && !previousArrangement,
    chartsLoaded: session.loaded, openLibrary: () => router.push('/charts'),
    addNow: () => { if (!session.addNow()) setReplaceNow(true); },
    capturing, locked: orientationMode === 'static', hasTarget: loaded && !!clock.targetId,
    targetKind: clock.kind, canStepBackward: clock.canStepBackward, canStepForward: clock.canStepForward,
    aspects: { ...preset.aspects, showPatterns: !!preset.aspects.showPatterns },
    openSettings: () => { setSettingsTargetId(session.targetId ?? undefined); setSettingsRings(undefined); setSettingsOpen(true); }, openDisplay: () => { if (display.state.loaded) setSheetOpen(true); },
    toggleOrientation: () => { void display.update({ ...display.preset, orientation: { ...display.preset.orientation, mode: orientationMode === 'static' ? 'ascendant' : 'static' } }); },
    rotateOrientation: direction => {
      const next = applyAppearance(display.preset, rotateOrientation(preset, session.active.length, orientationMode, config?.orientation, direction));
      void display.update({ ...next, orientation: { ...next.orientation, mode: 'static' } });
    },
    resetOrientation: () => changePreset(resetOrientation(preset, renderingPreset(displayTemplate(localPreset.templateId ?? 'classic')!))),
    screenshot: capture, step: clock.step, reset: clock.reset,
    toggleDisplay: key => changePreset({ ...preset, aspects: { ...preset.aspects, [key]: !preset.aspects[key] } }),
  });

  const selectPreset = (id: string) => { void display.select(id); };
  const previewCharts = session.active.flatMap(item => {
    const chart = session.calculations[item.id]?.result?.chart;
    return chart ? [{ instanceId: item.id, name: item.name, chart, starNames: stars.names }] : [];
  });

  const starCharts = session.active.map(item => ({ id: item.id, name: item.name, status: session.calculations[item.id]?.status,
    missingStars: session.calculations[item.id]?.result?.chart.missingStars?.filter(name => stars.names.includes(name)) }));
  const settingsTarget: StarRingTarget = { layout: Math.max(1, session.active.length) as ChartCount, chartId: settingsTargetId };
  const settingsGuidance = settingsTargetId ? starRingGuidance(localPreset, starCharts, settingsTarget) : undefined;
  const closeSettings = () => { setSettingsOpen(false); };
  const displayEditorProps = config ? { visible: true, displayPreset: localPreset, repository: display, previewCharts, starCharts,
    preset, presetName, bodyNames, onSelectPreset: selectPreset, config, onChangePreset: changePreset } : undefined;
  const manageSettingsRings = () => {
    const live = starRingGuidance(display.preset, starCharts, settingsTarget);
    if (live.manageable && displayEditorProps && display.state.loaded) setSettingsRings({ ...settingsTarget, sourceSlot: live.sourceSlot });
  };

  return (
    <MarkingMenuProvider enabled={focused && !sheetOpen && !settingsOpen && !replaceNow && !capturing} onActiveChange={setMenuActive}>
    <View ref={screen} collapsable={false} onLayout={event => {
      const { width, height } = event.nativeEvent.layout; setViewport({ width, height });
      cardDrag.invalidate();
      screen.current?.measureInWindow((x, y, width, height) => setWindowRect({ x, y, width, height }));
    }}
      style={{ flex: 1, backgroundColor: theme.color.bgSolidBase }}>
      {/* The canvas fills the screen; the measured slot below locates the wheel
          without clipping it. Cards and the stepper bound the resting slot. */}
      {config && wheelSize > 0 && <InteractiveChartWheel config={config} size={wheelSize} viewport={viewport}
        baseCenter={wheelCenter} selectedIds={selectedIds} onSelectionChange={setSelectedIds}
        selectionStyle={preset.selection} enabled={display.state.loaded && !sheetOpen && !settingsOpen && !replaceNow && !menuActive && !capturing && !previousArrangement}
        onHideBody={name => changePreset(toggleBody(preset,name,false))} />}
      <ChartToolbar topInset={insets.top}
        actions={actions} />

      {display.state.loadError && <View><Pressable accessibilityRole="button" onPress={() => { void display.load(); }}><Text accessibilityRole="alert" style={{color:theme.color.txAccent}}>Couldn’t restore display presets. Tap to retry.</Text></Pressable><Pressable accessibilityRole="button" onPress={() => Alert.alert('Reset display presets?', 'This replaces all saved custom presets on this device.',[{text:'Cancel',style:'cancel'},{text:'Reset',style:'destructive',onPress:()=>{void display.reset();}}])}><Text style={{color:theme.color.txAccent}}>Reset display presets</Text></Pressable></View>}
      {display.state.saveError && !sheetOpen && <Pressable accessibilityRole="button" onPress={() => { void display.retrySave(); }}><Text accessibilityRole="alert" style={{color:theme.color.txAccent}}>Display changes haven’t been saved. Tap to retry.</Text></Pressable>}
      {(stars.state.loadError || stars.state.saveError) && <Pressable accessibilityRole="button" onPress={() => router.push('/star-library')}><Text accessibilityRole="alert" style={[theme.type.whyteXs,{ color:theme.color.txAccent,paddingHorizontal:24 }]}>{stars.state.loadError ? 'Couldn’t restore your star library. Open to retry.' : 'Star changes haven’t been saved. Open to retry.'}</Text></Pressable>}
      {session.active.some(item => (session.calculations[item.id]?.result?.chart.missingStars?.length ?? 0) > 0) && <Pressable accessibilityRole="button" onPress={() => router.push('/star-library')}><Text accessibilityRole="alert" style={[theme.type.whyteXs,{color:theme.color.txAccent,paddingHorizontal:24}]}>{session.active.flatMap(item => { const missing = session.calculations[item.id]?.result?.chart.missingStars ?? []; return missing.length ? [`${item.name}: ${missing.join(', ')}`] : []; }).join(' · ')} could not be calculated. Review star library.</Text></Pressable>}
      <ActiveChartCards session={cardDrag} chartActions={actions} />
      {(session.loadError || session.saveError) && <Pressable accessibilityRole="button"
        onPress={session.loadError ? session.retryLoad : session.retryPersistence} style={{ paddingHorizontal: theme.space.lg, paddingVertical: theme.space.sm }}>
        <Text accessibilityRole="alert" style={[theme.type.whyteXs, { color: theme.color.txAccent }]}>
          {session.loadError ? 'Couldn’t restore charts. Tap to retry; stored charts have not been replaced.' : 'Changes haven’t been saved on this device. Tap to retry.'}
        </Text>
      </Pressable>}
      <View pointerEvents="box-none" onLayout={event => { const { y, height } = event.nativeEvent.layout; setChartArea({ y, height }); }} style={{ flex: 1, minHeight: 0, alignItems: 'center', justifyContent: 'center' }}>
        {config && wheelSize > 0 ? <View pointerEvents="none"
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
          onPress={() => failed.forEach(item => session.calculations[item.id]?.retry())} style={{ height: 44, justifyContent: 'center', paddingHorizontal: theme.space.md }}>
          <Text numberOfLines={1} accessibilityRole="alert" style={[theme.type.whyteXs, { color: theme.color.txAccent }]}>Showing previous positions for {failed.map(item => item.name).join(', ')}. Retry</Text>
        </Pressable>}
      </View>

      <View onLayout={event => setStepperTop(event.nativeEvent.layout.y)} style={{ marginHorizontal: 16, marginBottom: insets.bottom + theme.space.sm }}>
        <SelectionStepper config={config} selectedIds={selectedIds} active={focused}
          enabled={focused && !sheetOpen && !settingsOpen && !replaceNow && !menuActive && !capturing && !previousArrangement} />
      </View>

      <ChartPutAwayOverlay session={cardDrag} stepperTop={stepperTop} />
      <ReplacementChooser active={session.active} visible={replaceNow} onCancel={() => setReplaceNow(false)}
        onSelect={id => { if (session.addNow(id)) setReplaceNow(false); }} />
      <SettingsSheet visible={settingsOpen} settings={settings} saveError={saveError} onChange={update} onClose={closeSettings}
        starRingContext={settingsGuidance ? { message: settingsGuidance.message, onManage: settingsGuidance.manageable && displayEditorProps && display.state.loaded ? manageSettingsRings : undefined } : undefined}
        ringEditor={settingsRings && displayEditorProps ? <DisplayEditor {...displayEditorProps} initialPage="rings" initialLayout={settingsRings.layout} initialSourceSlot={settingsRings.sourceSlot} previewPosition={settingsPreview} onChangePreviewPosition={setSettingsPreview} onClose={closeSettings} onBack={() => setSettingsRings(undefined)} /> : undefined} />
      {config && display.state.loaded && <DisplaySheet
        visible={sheetOpen}
        displayPreset={localPreset} repository={display} previewCharts={previewCharts} starCharts={starCharts}
        preset={preset}
        presetName={presetName}
        bodyNames={bodyNames}
        onSelectPreset={selectPreset}
        config={config}
        onChangePreset={changePreset}
        onClose={() => setSheetOpen(false)}
      />}
    </View>
    </MarkingMenuProvider>
  );
}
