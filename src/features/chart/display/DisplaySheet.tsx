import { PatternIcon } from './PatternIcon';
import { useEffect, useMemo, useState } from 'react';
import { Animated, Modal, PanResponder, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Canvas } from '@shopify/react-native-skia';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';
import type { Preset, SelectionStyleOverride } from '../schema/preset';
import { ASPECT_TYPES, CELESTIAL_BODIES, ZODIAC_SIGNS } from '../schema/enums.gen';
import { celestialBodyColor } from '../render/colors';
import { Glyph } from '../render/Glyph';
import { GLYPH_ASSETS, type GlyphName } from '../render/glyph-map.gen';
import { ChartWheel } from '../render/ChartWheel';
import type { ChartRenderingConfiguration } from '../config/ChartRenderingConfiguration';
import { isBodyEnabled, toggleBody } from './displayPreset';
import { BUNDLED_PRESET_NAMES } from './presets';
import { LABEL_CONTROLS, planetStyles, updateOrientation, updatePlanetStyles } from './sharedControls';
import { Action, Choices, LinkRow, Note, NumberRow, Section, Toggle } from './controls';
import { resolveAspectType } from '../geometry/AspectFilter';
import { PATTERN_NAMES } from '../geometry/AspectPatterns';
export interface DisplaySheetProps {
    visible: boolean;
    preset: Preset;
    presetName: string;
    bodyNames: string[];
    config: ChartRenderingConfiguration;
    onSelectPreset: (name: string) => void;
    onChangePreset: (next: Preset) => void;
    onClose: () => void;
}
const PLANETS = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
const LOTS = ['Part of Fortune', 'Lot of Spirit', 'Lot of Eros'];
const POINTS = ['Ascendant', 'Midheaven', 'Descendant', 'Imum Coeli', 'North Node', 'South Node', 'Vertex', 'Black Moon Lilith'];
const ASTEROIDS = ['Chiron', 'Ceres', 'Pallas', 'Juno', 'Vesta', 'Eros', 'Pholus'];
const TITLES: Record<string, string> = { presets: 'Display preset', asteroids: 'Asteroids', lots: 'Lots', aspects: 'Aspect types & orbs', patterns: 'Aspect patterns', filters: 'Aspect filtering', lines: 'Aspect line styling', selection: 'Selection', orientation: 'Static orientation' };
const FILTERS = [['showSeparatingAspects', 'Separating aspects'], ['showFalseAspects', 'False aspects'], ['mutualAspectsOnly', 'Mutual aspects only'], ['interAspectsOnly', 'Inter aspects only'], ['filterBySelection', 'Filter by selection']] as const;
const SELECTION = [
    ['showBackgroundCircle', 'Highlight selected'], ['includeAspectedPlanets', 'Include aspected planets'],
    ['includeConjunctFixedStars', 'Include conjunct fixed stars'], ['includeRulershipPlanets', 'Include rulership planets'],
    ['ignoreZodiacRingOpacity', 'Keep zodiac at full opacity'], ['affectsGlyphs', 'Symbols'],
    ['affectsDegreeText', 'Degree text'], ['affectsDegreeMarks', 'Degree marks'],
    ['affectsHouseNumbers', 'House numbers'], ['affectsCuspLines', 'Cusp lines'],
] as const satisfies readonly (readonly [
    keyof SelectionStyleOverride,
    string
])[];
/** The native sheet owns dismissal. Its inner handle only reveals/covers the
 * fixed-size preview and retains the released position without detents. */
export function DisplaySheet(props: DisplaySheetProps) {
    return <Modal visible={props.visible} animationType="slide" presentationStyle="pageSheet" allowSwipeDismissal onRequestClose={props.onClose}>
    <SafeAreaProvider><DisplayEditor {...props}/></SafeAreaProvider>
  </Modal>;
}
function DisplayEditor({ preset, presetName, bodyNames, config, onChangePreset: change, onSelectPreset, onClose }: DisplaySheetProps) {
    const t = useTheme();
    const insets = useSafeAreaInsets();
    const window = useWindowDimensions();
    const [frame, setFrame] = useState({ width: window.width, height: window.height });
    const width = frame.width;
    const [tab, setTab] = useState('Bodies');
    const [page, setPage] = useState<string | null>(null);
    const [previewPosition, setPreviewPosition] = useState<number | null>(null);
    const previewHeight = Math.max(0, Math.min(width, frame.height - insets.bottom - 144));
    const [cover] = useState(() => new Animated.Value(previewHeight));
    const restingPosition = Math.max(0, Math.min(previewHeight, previewPosition ?? previewHeight));
    const previewShown = restingPosition > 0;
    useEffect(() => {
        cover.setValue(restingPosition);
    }, [cover, restingPosition]);
    const responder = useMemo(() => {
        let start = 0;
        const clamp = (value: number) => Math.max(0, Math.min(previewHeight, value));
        const finish = (value: number) => {
            const position = clamp(value);
            cover.setValue(position);
            setPreviewPosition(position);
        };
        return PanResponder.create({
            onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 5,
            onPanResponderGrant: () => { cover.stopAnimation(v => { start = v; }); },
            onPanResponderMove: (_, g) => cover.setValue(clamp(start + g.dy)),
            onPanResponderRelease: (_, g) => finish(start + g.dy),
            onPanResponderTerminate: () => cover.stopAnimation(finish),
        });
    }, [cover, previewHeight]);
    const styles = planetStyles(preset);
    const aspects = preset.aspects;
    const patterns = aspects.patterns ?? { enabledTypes: [...PATTERN_NAMES], orb: 5 };
    const aspect = (patch: Partial<Preset['aspects']>) => change({ ...preset, aspects: { ...aspects, ...patch } });
    const line = (patch: Partial<Preset['aspectOverlay']>) => change({ ...preset, aspectOverlay: { ...preset.aspectOverlay, ...patch } });
    const selection = (patch: Partial<Preset['selection']>) => change({ ...preset, selection: { ...preset.selection, ...patch } });
    const enabledCount = (names: string[]) => `${names.filter(n => isBodyEnabled(preset, n)).length} of ${names.length} shown`;
    const bodyToggle = (name: string) => <Toggle key={name} label={name} value={isBodyEnabled(preset, name)} onChange={v => change(toggleBody(preset, name, v))}/>;
    const list = page === 'lots' ? LOTS : ASTEROIDS;
    const currentOrientation = preset.soloChart.globalSettings.staticOrientationDegree;
    const sizeValue = (key: 'glyphSize' | 'degreeTextFontSize') => styles.every(s => s[key] === styles[0]?.[key]) ? styles[0]?.[key] : undefined;
    let content;
    if (page === 'presets')
        content = <Section title="Choose a preset">{BUNDLED_PRESET_NAMES.map(name => <LinkRow key={name} label={name.charAt(0).toUpperCase() + name.slice(1)} detail={name === presetName ? 'Selected' : undefined} onPress={() => { onSelectPreset(name); setPage(null); }}/>)}</Section>;
    else if (page === 'lots' || page === 'asteroids')
        content = <Section title={TITLES[page]}><Note>Included when their positions are available in the chart.</Note>{list.map(bodyToggle)}</Section>;
    else if (page === 'aspects')
        content = <Section title="Types & tolerance">{Object.entries(ASPECT_TYPES).map(([key, info]) => ({ ...info, displayName: resolveAspectType(key)!.wireName })).map(a => <View key={a.displayName}>
    <Toggle label={a.displayName} detail={`${a.angle}°`} value={aspects.enabledTypes.includes(a.displayName)} onChange={v => aspect({ enabledTypes: v ? [...aspects.enabledTypes, a.displayName] : aspects.enabledTypes.filter(n => n !== a.displayName) })}/>
    {aspects.enabledTypes.includes(a.displayName) && <NumberRow label={`${a.displayName} orb ±`} value={aspects.orbs.orbs[a.displayName] ?? a.defaultOrb} onChange={v => aspect({ orbs: { orbs: { ...aspects.orbs.orbs, [a.displayName]: v } } })}/>}
  </View>)}</Section>;
    else if (page === 'patterns')
        content = <><Section title="Tolerance"><NumberRow label="Pattern orb ±" value={patterns.orb} onChange={v => aspect({ patterns: { ...patterns, orb: v } })}/><Note>Every defining aspect must be within this tolerance.</Note></Section><Section title="Shapes">{PATTERN_NAMES.map(name => <Toggle key={name} label={name} leading={<PatternIcon name={name} />} value={patterns.enabledTypes.includes(name)} onChange={v => aspect({ patterns: { ...patterns, enabledTypes: v ? [...patterns.enabledTypes, name] : patterns.enabledTypes.filter(n => n !== name) } })}/>)}</Section></>;
    else if (page === 'filters')
        content = <Section title="Rendering">{FILTERS.map(([key, name]) => <Toggle key={key} label={name} value={aspects[key]} disabled={!aspects.enabled || key === 'interAspectsOnly'} detail={key === 'interAspectsOnly' ? 'Available with multiple charts' : key === 'filterBySelection' ? 'Used when a body is selected' : undefined} onChange={v => aspect({ [key]: v })}/>)}</Section>;
    else if (page === 'orientation')
        content = <Section title="Sign at the left edge"><Choices label="Static orientation" value={currentOrientation} options={ZODIAC_SIGNS.map((name, i) => [i * 30, name.charAt(0).toUpperCase() + name.slice(1)] as const)} onChange={v => change(updateOrientation(preset, v))}/></Section>;
    else if (page === 'lines')
        content = <Section title="Aspect lines">
    <Choices label="Color" value={preset.aspectOverlay.colorMode} options={[["byType", "Aspect"], ["byCelestial", "Planet"], ["monochrome", "One color"]]} onChange={v => line({ colorMode: v })}/>
    <Choices label="Shape" value={preset.aspectOverlay.renderMode} options={[["straight", "Straight"], ["bezier", "Curved"]]} onChange={v => line({ renderMode: v })}/>
    {preset.aspectOverlay.renderMode === 'bezier' && <NumberRow label="Curve strength" value={preset.aspectOverlay.bezierCurveStrength} onChange={v => line({ bezierCurveStrength: v })} max={1} step={.05} suffix=""/>}
    <NumberRow label="Line width" value={preset.aspectOverlay.lineWidth} onChange={v => line({ lineWidth: v })} min={.25} max={4} step={.25} suffix=""/>
    <NumberRow label="Opacity" value={preset.aspectOverlay.opacity * 100} onChange={v => line({ opacity: v / 100 })} max={100} step={5} suffix="%"/>
    <Toggle label="Dash separating aspects" value={preset.aspectOverlay.useDashedForSeparating} onChange={v => line({ useDashedForSeparating: v })}/>
  </Section>;
    else if (page === 'selection')
        content = <><Note>Selection preferences are retained in the preset. Chart selection is coming in a later renderer pass.</Note><Section title="Highlight & related bodies">{SELECTION.slice(0, 4).map(([key, label]) => <Toggle key={key} label={label} value={preset.selection[key]} onChange={v => selection({ [key]: v })}/>)}</Section><Section title="Dimming"><NumberRow label="Unselected opacity" value={preset.selection.unselectedOpacity * 100} max={100} step={5} suffix="%" onChange={v => selection({ unselectedOpacity: v / 100 })}/><NumberRow label="Related opacity" value={preset.selection.relatedOpacity * 100} max={100} step={5} suffix="%" onChange={v => selection({ relatedOpacity: v / 100 })}/>{SELECTION.slice(4).map(([key, label]) => <Toggle key={key} label={label} value={preset.selection[key]} onChange={v => selection({ [key]: v })}/>)}</Section></>;
    else if (tab === 'Bodies')
        content = <><Section title="Planets"><View style={{ alignItems: 'flex-end' }}><Action label={PLANETS.every(n => isBodyEnabled(preset, n)) ? 'Hide all' : 'Show all'} onPress={() => {
                const enabled = !PLANETS.every(n => isBodyEnabled(preset, n));
                change(PLANETS.reduce((p, n) => toggleBody(p, n, enabled), preset));
            }}/></View><View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{PLANETS.map(name => {
                const enabled = isBodyEnabled(preset, name);
                const [bodyId, body] = Object.entries(CELESTIAL_BODIES).find(([, b]) => b.displayName === name)!;
                const glyph = `celestials/${body?.glyphAsset}` as GlyphName;
                return <Pressable key={name} accessibilityRole="checkbox" accessibilityLabel={name} accessibilityState={{ checked: enabled }} onPress={() => change(toggleBody(preset, name, !enabled))} style={{ width: '20%', paddingVertical: 12, alignItems: 'center', opacity: enabled ? 1 : .35 }}>
      {glyph in GLYPH_ASSETS && <Canvas style={{ width: 30, height: 30 }}><Glyph name={glyph} x={15} y={15} size={25} color={celestialBodyColor(bodyId, preset.colors, t)}/></Canvas>}
      <Text style={[t.type.whyteXxs, { color: t.color.txPrimary, marginTop: 6 }]}>{name}</Text>
    </Pressable>;
            })}</View></Section><Section title="Points">{POINTS.filter(n => bodyNames.includes(n)).map(bodyToggle)}</Section><Section title="More bodies"><LinkRow label="Asteroids" detail={enabledCount(ASTEROIDS)} onPress={() => setPage('asteroids')}/><LinkRow label="Lots" detail={enabledCount(LOTS)} onPress={() => setPage('lots')}/></Section></>;
    else if (tab === 'Details')
        content = <><Section title="Beside each planet">{LABEL_CONTROLS.map(([key, label]) => {
                const all = styles.length > 0 && styles.every(s => s[key]);
                const mixed = !all && styles.some(s => s[key]);
                return <Toggle key={key} label={label} value={all} detail={mixed ? 'Varies by layer · change to apply everywhere' : undefined} onChange={v => change(updatePlanetStyles(preset, { [key]: v }))}/>;
            })}</Section><Section title="Aspects"><Toggle label="Aspect lines" value={aspects.enabled} onChange={v => aspect({ enabled: v })}/><Toggle label="Aspect patterns" value={aspects.showPatterns ?? false} onChange={v => aspect({ showPatterns: v })}/><LinkRow label="Aspect types & orbs" detail={`${aspects.enabledTypes.length} types shown`} onPress={() => setPage('aspects')}/><LinkRow label="Aspect patterns" detail={`${patterns.enabledTypes.length} shapes · ±${patterns.orb}°`} onPress={() => setPage('patterns')}/><LinkRow label="Aspect filtering" onPress={() => setPage('filters')}/></Section><Section title="Orientation"><LinkRow label="Static orientation" detail={ZODIAC_SIGNS[currentOrientation / 30] ?? `${currentOrientation}°`} onPress={() => setPage('orientation')}/></Section></>;
    else
        content = <><Section title="Reading comfort"><Choices label="Symbol size" value={sizeValue('glyphSize')} options={[[16, 'S'], [20, 'M'], [24, 'L']]} onChange={v => change(updatePlanetStyles(preset, { glyphSize: v }))}/><Choices label="Annotation size" value={sizeValue('degreeTextFontSize')} options={[[7.5, 'S'], [9.6, 'M'], [12, 'L']]} onChange={v => change(updatePlanetStyles(preset, { degreeTextFontSize: v }))}/></Section><Section title="Aspect lines"><LinkRow label="Aspect line styling" detail="Color, shape, weight, and opacity" onPress={() => setPage('lines')}/></Section><Section title="Interaction"><LinkRow label="Selection" detail="Highlighting, dimming, and related bodies" onPress={() => setPage('selection')}/></Section></>;
    return <View style={{ flex: 1, backgroundColor: t.color.bgSolidBase, paddingTop: insets.top }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, height: 52 }}><Action label="Close" onPress={onClose}/><Text style={[t.type.whyteMd, { color: t.color.txPrimary }]}>Display</Text><Action label={`${presetName.charAt(0).toUpperCase() + presetName.slice(1)} ⌄`} onPress={() => setPage('presets')}/></View>
    <View style={{ flex: 1 }} onLayout={({ nativeEvent: { layout } }) => setFrame(previous => previous.width === layout.width && previous.height === layout.height ? previous : { width: layout.width, height: layout.height })}><View style={{ position: 'absolute', top: 0, alignSelf: 'center' }}><ChartWheel config={config} size={width}/></View>
      <Animated.View testID="preview-cover" style={{ position: 'absolute', top: cover, bottom: 0, width: '100%', backgroundColor: t.color.bgSolidCard, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: t.border.hairline, borderColor: t.color.bdCard }}>
        <View testID="preview-handle" {...responder.panHandlers}><Pressable accessibilityRole="button" accessibilityLabel={previewShown ? 'Hide chart preview' : 'Show chart preview'} onPress={() => setPreviewPosition(previewShown ? 0 : previewHeight)} style={{ height: 36, alignItems: 'center', justifyContent: 'center' }}><View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: t.color.txTertiary }}/></Pressable></View>
        {page ? <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12 }}><Action label="‹ Back" onPress={() => setPage(null)}/><Text style={[t.type.whyteSm, { color: t.color.txPrimary, flex: 1 }]}>{TITLES[page]}</Text></View> : <View style={{ paddingHorizontal: 18 }}><Choices label="" value={tab} options={[["Bodies", "Bodies"], ["Details", "Details"], ["Style", "Style"]]} onChange={setTab}/></View>}
        <ScrollView key={page ?? tab} contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 18, paddingBottom: insets.bottom + 28 }}>{content}</ScrollView>
      </Animated.View>
    </View>
  </View>;
}
