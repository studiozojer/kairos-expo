/** Device-local authoring model. Portable Swift documents are reference fixtures,
 * not the storage contract. Tags are attached only at the rendering boundary. */
import * as Crypto from 'expo-crypto';
import type { ChartColors, GlobalChartVariables, RingThickness, VisibilityConfiguration } from '../schema/core-types';
import { GLOBAL_CHART_VARIABLES_DEFAULT } from '../schema/core-types';
import type { Preset, AspectConfiguration, SelectionStyleOverride } from '../schema/preset';
import { PRESET_DEFAULT } from '../schema/preset';
import { defaultRingStyle, type ZodiacRingStyle, type PlanetsRingStyle, type HousesRingStyle, type CuspAnnotationsStyle, type SignRulersStyle, type DecansStyle, type TermsStyle, type AspectOverlayStyle } from '../schema/ring-styles';
import { defaultRingContent } from '../schema/ring-content';
import type { RingModule } from '../schema/ring-module';

export type ChartCount = 1 | 2 | 3;
export type SourceSlot = 1 | 2 | 3;
type Style<T> = Omit<T, '$type'>;
type Base = { id: string; enabled: boolean; thickness: RingThickness };
export type DisplayRing = Base & (
  | { kind: 'zodiac'; style: Omit<Style<ZodiacRingStyle>, 'showDegreeMarkers'>; options: { showSymbols: boolean; showDegrees: boolean; showBoundaries: boolean } }
  | { kind: 'planets'; sourceSlot: SourceSlot; style: Omit<Style<PlanetsRingStyle>, 'showDegreeMarks' | 'thickAngularLines'>; options: Record<string, never> }
  | { kind: 'houses'; sourceSlot: SourceSlot; style: Omit<Style<HousesRingStyle>, 'numberFontWeight' | 'thickAngularLines' | 'extendCuspsToRing'>; options: { showCusps: boolean; showNumbers: boolean } }
  | { kind: 'cuspAnnotations'; sourceSlot: SourceSlot; style: Style<CuspAnnotationsStyle>; options: { showSignGlyph: boolean; showDegrees: boolean; showMinutes: boolean } }
  | { kind: 'signRulers'; style: Style<SignRulersStyle>; options: { system: 'traditional' | 'modern' } }
  | { kind: 'decans'; style: Omit<Style<DecansStyle>, 'numberFontWeight'>; options: { system: 'chaldean' | 'triplicity' | 'modern'; showNumbers: boolean } }
  | { kind: 'terms'; style: Style<TermsStyle>; options: { system: 'egyptian' | 'ptolemaic' | 'chaldean' } }
);
export type RingKind = DisplayRing['kind'];
export const RING_KINDS: RingKind[] = ['zodiac', 'planets', 'houses', 'cuspAnnotations', 'signRulers', 'decans', 'terms'];
export const RING_TITLES: Record<RingKind, string> = { zodiac: 'Zodiac', planets: 'Planets', houses: 'Houses', cuspAnnotations: 'Cusp degrees', signRulers: 'Sign rulers', decans: 'Decans', terms: 'Terms' };
export interface DisplayLayout { rings: DisplayRing[]; geometry: Omit<GlobalChartVariables, 'staticOrientationDegree' | 'variableRingSizing'> }
export interface DisplayPreset {
  schemaVersion: 1; id: string; name: string; templateId?: string;
  colors: ChartColors; visibility: VisibilityConfiguration;
  selection: Omit<SelectionStyleOverride, 'includeConjunctFixedStars' | 'conjunctFixedStarsOrb'>;
  aspects: Omit<AspectConfiguration, 'showGrid'>;
  aspectOverlay: Style<AspectOverlayStyle>;
  orientation: { mode: 'static' | 'ascendant'; degree: number };
  layouts: Record<ChartCount, DisplayLayout>;
}
export const newPresetId = () => Crypto.randomUUID();
export function createRing(kind: RingKind, sourceSlot: SourceSlot = 1, id = newPresetId()): DisplayRing {
  const { $type: _tag, ...style } = defaultRingStyle(kind);
  for (const key of ['numberFontWeight', 'thickAngularLines', 'showDegreeMarks', 'showSpeeds', 'extendCuspsToRing']) delete (style as Record<string, unknown>)[key];
  const { $type: _contentTag, ...options } = defaultRingContent(kind);
  for (const key of ['showRetrograde', 'showSpeeds']) delete (options as Record<string, unknown>)[key];
  if (kind === 'zodiac') { delete (style as Record<string,unknown>).showDegreeMarkers; (options as Record<string,unknown>).showDegrees = true; }
  if (kind === 'decans') (options as Record<string,unknown>).showNumbers = true;
  if (kind === 'houses') delete (options as Record<string, unknown>).system;
  return { id, kind, enabled: true, thickness: kind === 'planets' ? { kind: 'auto' } : { kind: 'fixed', value: kind === 'terms' ? 22 : 24 }, style, options,
    ...(['planets','houses','cuspAnnotations'].includes(kind) ? { sourceSlot } : {}) } as DisplayRing;
}
export function copyPreset(preset: DisplayPreset, name = `${preset.name.slice(0,95)} copy`): DisplayPreset {
  const next: DisplayPreset = JSON.parse(JSON.stringify(preset));
  next.id = newPresetId(); next.name = name;
  for (const count of [1,2,3] as const) next.layouts[count].rings.forEach(ring => { ring.id = newPresetId(); });
  return next;
}
export function editRing(preset: DisplayPreset, count: ChartCount, id: string, change: (ring: DisplayRing) => DisplayRing): DisplayPreset {
  return { ...preset, layouts: { ...preset.layouts, [count]: { ...preset.layouts[count], rings: preset.layouts[count].rings.map(ring => ring.id === id ? change(ring) : ring) } } };
}
export function moveRing(preset: DisplayPreset, count: ChartCount, id: string, direction: -1 | 1): DisplayPreset {
  const rings = [...preset.layouts[count].rings], index = rings.findIndex(ring => ring.id === id), destination = index + direction;
  if (index < 0 || destination < 0 || destination >= rings.length) return preset;
  [rings[index], rings[destination]] = [rings[destination], rings[index]];
  return { ...preset, layouts: { ...preset.layouts, [count]: { ...preset.layouts[count], rings } } };
}
/** Existing geometry/overlays consume this resolved view. Never store it. */
export function renderingPreset(preset: DisplayPreset): Preset {
  const slot = (count: ChartCount) => ({ globalSettings: { ...GLOBAL_CHART_VARIABLES_DEFAULT, ...preset.layouts[count].geometry, staticOrientationDegree: preset.orientation.degree },
    rings: preset.layouts[count].rings.map(ring => ({ id: ring.id, type: ring.kind, enabled: ring.enabled, thickness: ring.thickness,
      ...('sourceSlot' in ring ? { sourceSlot: ring.sourceSlot } : {}),
      style: { ...defaultRingStyle(ring.kind), ...ring.style, ...(ring.kind === 'zodiac' ? { showDegreeMarkers: ring.options.showDegrees } : {}) }, content: { ...defaultRingContent(ring.kind), ...ring.options } } as RingModule)) });
  return { ...PRESET_DEFAULT, id: preset.id, name: preset.name, colors: preset.colors, visibility: preset.visibility,
    selection: { ...PRESET_DEFAULT.selection, ...preset.selection }, aspects: { ...preset.aspects, showGrid: false },
    aspectOverlay: { ...PRESET_DEFAULT.aspectOverlay, ...preset.aspectOverlay }, soloChart: slot(1), dualChart: slot(2), tripleChart: slot(3) };
}
/** Lens for the existing appearance controls; ring composition edits use IDs directly. */
export function applyAppearance(preset: DisplayPreset, view: Preset): DisplayPreset {
  const { showGrid: _grid, ...aspects } = view.aspects;
  const { $type: _tag, ...aspectOverlay } = view.aspectOverlay;
  const { includeConjunctFixedStars: _stars, conjunctFixedStarsOrb: _orb, ...selection } = view.selection;
  const next = { ...preset, colors: view.colors, visibility: view.visibility, aspects, aspectOverlay, selection,
    orientation: { ...preset.orientation, degree: view.soloChart.globalSettings.staticOrientationDegree }, layouts: { ...preset.layouts } };
  for (const [count, slot] of [[1,view.soloChart],[2,view.dualChart],[3,view.tripleChart]] as const) {
    next.layouts[count] = { ...preset.layouts[count], rings: preset.layouts[count].rings.map(ring => {
      const style = slot.rings.find(module => module.id === ring.id)?.style;
      if (!style) return ring;
      const { $type: _styleTag, ...updated } = style;
      for (const key of ['numberFontWeight','thickAngularLines','showDegreeMarks','extendCuspsToRing']) delete (updated as Record<string, unknown>)[key];
      if (ring.kind === 'zodiac') delete (updated as Record<string,unknown>).showDegreeMarkers;
      return { ...ring, style: updated } as DisplayRing;
    }) };
  }
  return next;
}
