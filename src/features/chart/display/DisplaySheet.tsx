import { SKY_ASTEROIDS } from '../data/skyBodies';
import { ChartSheet, SheetBackRow } from '../components/ChartSheet';
import { PlanetPicker } from './PlanetPicker';
import { SegmentedControl } from '@expo/ui/community/segmented-control';
import { DisplayHeader } from './DisplayHeader';
import { previewGesture } from './previewGesture';
import { PatternIcon } from './PatternIcon';
import { useEffect, useMemo, useState } from 'react';
import { Animated, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';
import { DEFAULT_PATTERN_ORB, type Preset, type SelectionStyleOverride } from '../schema/preset';
import { ASPECT_TYPES, ZODIAC_SIGNS } from '../schema/enums.gen';
import { ChartWheel } from '../render/ChartWheel';
import type { ChartRenderingConfiguration } from '../config/ChartRenderingConfiguration';
import { isBodyEnabled, toggleBody } from './displayPreset';
import { LABEL_CONTROLS, planetStyles, updateOrientation, updatePlanetStyles } from './sharedControls';
import { Choices, LinkRow, Note, NumberRow, Section, Toggle } from './controls';
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
const DISPLAY_TABS = ['Bodies', 'Details', 'Style'];
const LOTS = ['Part of Fortune', 'Lot of Spirit', 'Lot of Eros'];
const POINTS = ['Ascendant', 'Midheaven', 'Descendant', 'Imum Coeli', 'North Node', 'South Node', 'Vertex', 'Black Moon Lilith'];
const ASTEROIDS = [...SKY_ASTEROIDS];
const TITLES: Record<string, string> = { asteroids: 'Asteroids', lots: 'Lots', aspects: 'Aspect types & orbs', patterns: 'Aspect patterns', filters: 'Aspect filtering', lines: 'Aspect line styling', selection: 'Selection', orientation: 'Static orientation' };
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
    // This component stays mounted when the native modal releases its contents.
    // Keep the preview preference here, outside both the modal and preset data.
    const [previewPosition, setPreviewPosition] = useState<number | null>(null);
    return <ChartSheet visible={props.visible} onClose={props.onClose}>
    <DisplayEditor {...props} previewPosition={previewPosition} onChangePreviewPosition={setPreviewPosition}/>
  </ChartSheet>;
}
interface DisplayEditorProps extends DisplaySheetProps {
    previewPosition: number | null;
    onChangePreviewPosition: (position: number) => void;
}
function DisplayEditor({ preset, presetName, bodyNames, config, onChangePreset: change, onSelectPreset, onClose, previewPosition, onChangePreviewPosition: setPreviewPosition }: DisplayEditorProps) {
    const t = useTheme();
    const insets = useSafeAreaInsets();
    const window = useWindowDimensions();
    const [frame, setFrame] = useState({ width: window.width, height: window.height });
    const width = frame.width;
    const [tab, setTab] = useState('Bodies');
    const [page, setPage] = useState<string | null>(null);
    const previewHeight = Math.max(0, Math.min(width, frame.height - insets.bottom - 144));
    const restingPosition = Math.max(0, Math.min(previewHeight, previewPosition ?? width / 2));
    const [cover] = useState(() => new Animated.Value(restingPosition));
    const previewShown = restingPosition > 0;
    useEffect(() => {
        cover.setValue(restingPosition);
    }, [cover, restingPosition]);
    const handleGesture = useMemo(
        () => previewGesture(cover, previewHeight, setPreviewPosition),
        [cover, previewHeight, setPreviewPosition],
    );
    const styles = planetStyles(preset);
    const aspects = preset.aspects;
    const patterns = aspects.patterns ?? { enabledTypes: [...PATTERN_NAMES], orb: DEFAULT_PATTERN_ORB };
    const aspect = (patch: Partial<Preset['aspects']>) => change({ ...preset, aspects: { ...aspects, ...patch } });
    const line = (patch: Partial<Preset['aspectOverlay']>) => change({ ...preset, aspectOverlay: { ...preset.aspectOverlay, ...patch } });
    const selection = (patch: Partial<Preset['selection']>) => change({ ...preset, selection: { ...preset.selection, ...patch } });
    const enabledCount = (names: string[]) => `${names.filter(n => isBodyEnabled(preset, n)).length} of ${names.length} shown`;
    const bodyToggle = (name: string) => <Toggle key={name} label={name} value={isBodyEnabled(preset, name)} onChange={v => change(toggleBody(preset, name, v))}/>;
    const list = page === 'lots' ? LOTS : ASTEROIDS;
    const currentOrientation = preset.soloChart.globalSettings.staticOrientationDegree;
    const sizeValue = (key: 'glyphSize' | 'degreeTextFontSize') => styles.every(s => s[key] === styles[0]?.[key]) ? styles[0]?.[key] : undefined;
    let content;
    if (page === 'lots' || page === 'asteroids')
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
        content = <><Note>Tap chart objects to select them. Tap empty space to clear selection.</Note><Section title="Highlight & related bodies">{SELECTION.slice(0, 4).map(([key, label]) => <Toggle key={key} label={label} value={preset.selection[key]} onChange={v => selection({ [key]: v })}/>)}</Section><Section title="Dimming"><NumberRow label="Unselected opacity" value={preset.selection.unselectedOpacity * 100} max={100} step={5} suffix="%" onChange={v => selection({ unselectedOpacity: v / 100 })}/><NumberRow label="Related opacity" value={preset.selection.relatedOpacity * 100} max={100} step={5} suffix="%" onChange={v => selection({ relatedOpacity: v / 100 })}/>{SELECTION.slice(4).map(([key, label]) => <Toggle key={key} label={label} value={preset.selection[key]} onChange={v => selection({ [key]: v })}/>)}</Section></>;
    else if (tab === 'Bodies')
        content = <><Section title="Planets"><PlanetPicker enabledBodies={preset.visibility.enabledBodies} colors={preset.colors}
              onToggle={name => change(toggleBody(preset, name, !isBodyEnabled(preset, name)))} /></Section><Section title="Points">{POINTS.filter(n => bodyNames.includes(n)).map(bodyToggle)}</Section><Section title="More bodies"><LinkRow label="Asteroids" detail={enabledCount(ASTEROIDS)} onPress={() => setPage('asteroids')}/><LinkRow label="Lots" detail={enabledCount(LOTS)} onPress={() => setPage('lots')}/></Section></>;
    else if (tab === 'Details')
        content = <><Section title="Beside each planet">{LABEL_CONTROLS.map(([key, label]) => {
                const all = styles.length > 0 && styles.every(s => s[key]);
                const mixed = !all && styles.some(s => s[key]);
                return <Toggle key={key} label={label} value={all} detail={mixed ? 'Varies by layer · change to apply everywhere' : undefined} onChange={v => change(updatePlanetStyles(preset, { [key]: v }))}/>;
            })}</Section><Section title="Aspects"><Toggle label="Aspect lines" value={aspects.enabled} onChange={v => aspect({ enabled: v })}/><Toggle label="Aspect patterns" value={aspects.showPatterns ?? false} onChange={v => aspect({ showPatterns: v })}/><LinkRow label="Aspect types & orbs" detail={`${aspects.enabledTypes.length} types shown`} onPress={() => setPage('aspects')}/><LinkRow label="Aspect patterns" detail={`${patterns.enabledTypes.length} shapes · ±${patterns.orb}°`} onPress={() => setPage('patterns')}/><LinkRow label="Aspect filtering" onPress={() => setPage('filters')}/></Section><Section title="Orientation"><LinkRow label="Static orientation" detail={ZODIAC_SIGNS[currentOrientation / 30] ?? `${currentOrientation}°`} onPress={() => setPage('orientation')}/></Section></>;
    else
        content = <><Section title="Reading comfort"><Choices label="Symbol size" value={sizeValue('glyphSize')} options={[[16, 'S'], [20, 'M'], [24, 'L']]} onChange={v => change(updatePlanetStyles(preset, { glyphSize: v }))}/><Choices label="Annotation size" value={sizeValue('degreeTextFontSize')} options={[[7.5, 'S'], [9.6, 'M'], [12, 'L']]} onChange={v => change(updatePlanetStyles(preset, { degreeTextFontSize: v }))}/></Section><Section title="Aspect lines"><LinkRow label="Aspect line styling" detail="Color, shape, weight, and opacity" onPress={() => setPage('lines')}/></Section><Section title="Interaction"><LinkRow label="Selection" detail="Highlighting, dimming, and related bodies" onPress={() => setPage('selection')}/></Section></>;
    return <View style={{ flex: 1, backgroundColor: t.color.bgSolidBase, paddingTop: insets.top }}>
    <DisplayHeader presetName={presetName} onClose={onClose} onSelectPreset={onSelectPreset} />
    <View style={{ flex: 1 }} onLayout={({ nativeEvent: { layout } }) => setFrame(previous => previous.width === layout.width && previous.height === layout.height ? previous : { width: layout.width, height: layout.height })}><View style={{ position: 'absolute', top: 0, alignSelf: 'center' }}><ChartWheel config={config} size={width}/></View>
      <Animated.View testID="preview-cover" style={{ position: 'absolute', top: cover, bottom: 0, width: '100%', backgroundColor: t.color.bgSolidCard, borderTopLeftRadius: 22, borderTopRightRadius: 22, borderWidth: t.border.hairline, borderColor: t.color.bdCard }}>
        <GestureDetector gesture={handleGesture}>
          <View testID="preview-handle" collapsable={false} accessible accessibilityRole="button"
            accessibilityLabel={previewShown ? 'Hide chart preview' : 'Show chart preview'}
            accessibilityHint="Drag to adjust the chart preview height, or double tap to toggle it."
            onAccessibilityTap={() => setPreviewPosition(previewShown ? 0 : previewHeight)}
            style={{ height: 28, alignItems: 'center', justifyContent: 'center' }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: t.color.txTertiary }}/>
          </View>
        </GestureDetector>
        {page ? <SheetBackRow title={TITLES[page]} onBack={() => setPage(null)} /> : <View style={{ paddingHorizontal: t.space.lg, paddingBottom: t.space.sm }}>
          <SegmentedControl testID="display-tabs" values={DISPLAY_TABS} selectedIndex={DISPLAY_TABS.indexOf(tab)}
            onValueChange={setTab} appearance={t.scheme} style={{ width: '100%' }} />
        </View>}
        <ScrollView key={page ?? tab} contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 18, paddingBottom: insets.bottom + 28 }}>{content}</ScrollView>
      </Animated.View>
    </View>
  </View>;
}
