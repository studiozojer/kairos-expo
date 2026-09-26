import React from 'react';
import { act, create } from 'react-test-renderer';
import { themeFor } from '@/theme';
import { buildConfiguration } from '../../config/buildConfiguration';
import chart from '../../fixtures/engine/seattle-2026.json';
import { parseAspectConfiguration } from '../../schema/preset';
import { bundledPreset } from '../../display/presets';
import { PatternOverlay, patternFillColor, patternFillOpacity } from '../PatternOverlay';
import { useWheelLayout } from '../useWheelLayout';
import { ChartPaintProvider, resolveColorValue, withAlphaFactor } from '../colors';
import type { PatternName } from '../../geometry/AspectPatterns';

const config = buildConfiguration(chart, bundledPreset('classic')!.preset);
config.aspects = { ...config.aspects, enabled: true, showPatterns: true, patterns: { enabledTypes: ['Grand Trine'], orb: 5 } };
config.rings = config.rings.map(ring => ring.type.kind === 'planets' ? { ...ring, type: { ...ring.type,
  placements: ring.type.placements.slice(0, 3).map((p, i) => ({ ...p, longitude: i * 120 })) } } : ring);
const theme = themeFor('dark');

test.each<[PatternName, 'trine' | 'square' | 'quincunx']>([
  ['Grand Trine', 'trine'], ['T-square', 'square'], ['Grand Cross', 'square'], ['Yod', 'quincunx'], ['Kite', 'trine'],
])('%s uses its defining aspect hue at 8%%, independent of line opacity', (name, aspect) => {
  const style = { ...config.aspectOverlayStyle, opacity: .9, aspectHues: { ...config.aspectOverlayStyle.aspectHues, trine: 'green', square: 'red', quincunx: 'purple' } };
  for (const colorMode of ['byType', 'byCelestial'] as const) {
    expect(patternFillColor(name, { ...style, colorMode }, theme)).toBe(withAlphaFactor(resolveColorValue({ source: 'hue', value: style.aspectHues[aspect], layer: 'primitive' }, theme), .08));
  }
});
test('monochrome uses the configured color and multiplies its existing alpha', () => {
  const style = { ...config.aspectOverlayStyle, colorMode: 'monochrome' as const, monochromeColor: { source: 'hex' as const, value: '#ff000080', layer: 'ic' as const } };
  expect(patternFillColor('Grand Trine', style, theme)).toBe(withAlphaFactor('#ff000080', .08));
});
function Probe({ selected = [] as string[], enabled = true, show = true, base = .08, weight = 0, deviation = 0, tolerance = 5 }) {
  const cfg = { ...config,
    aspectOverlayStyle: { ...config.aspectOverlayStyle, patternOpacity: base, patternOrbWeighting: weight },
    rings: config.rings.map(r => r.type.kind === 'planets' ? { ...r, type: { ...r.type, placements: r.type.placements.map((p, i) => ({ ...p, longitude: p.longitude + (i === 0 ? deviation : 0) })) } } : r),
    aspects: { ...config.aspects, enabled, showPatterns: show, patterns: { enabledTypes: ['Grand Trine'], orb: tolerance } } };
  const layout = useWheelLayout(cfg, 400);
  return <ChartPaintProvider value={theme}><PatternOverlay config={cfg} layout={layout} selectedIdentifiers={new Set(selected)} /></ChartPaintProvider>;
}
test('draws one fill with no outline, and yields to selection and aspect visibility', () => {
  let view: ReturnType<typeof create>;
  act(() => { view = create(<Probe />); });
  const paths = () => view!.root.findAll(node => (node.type as unknown) === 'skPath');
  expect(paths()).toHaveLength(1);
  expect(paths()[0].props.style).toBe('fill');
  for (const props of [{ selected: ['sun'] }, { enabled: false }, { show: false }]) {
    act(() => view!.update(<Probe {...props} />));
    expect(paths()).toHaveLength(0);
  }
  act(() => view!.update(<Probe />));
  expect(paths()).toHaveLength(1);
  act(() => view!.unmount());
});

test('selection reveals only complete patterns, permits extra selections, and restores all on clear', () => {
  const ids = config.rings.flatMap(r => r.type.kind === 'planets' ? r.type.placements.map(p => p.id) : []);
  let view: ReturnType<typeof create>;
  act(() => { view = create(<Probe />); });
  const paths = () => view!.root.findAll(node => (node.type as unknown) === 'skPath');
  for (const [selected, count] of [
    [ids.slice(0, 1), 0], [ids.slice(0, 2), 0], [ids, 1],
    [[...ids, 'extra-planet', 'house:1'], 1], [['house:1'], 0], [[], 1],
  ] as [string[], number][]) {
    act(() => view!.update(<Probe selected={selected} />));
    expect(paths()).toHaveLength(count);
  }
  act(() => view!.unmount());
});

test('missing pattern orb defaults to 3 degrees; explicit preset orbs are retained', () => {
  expect(parseAspectConfiguration({ patterns: { enabledTypes: ['Grand Trine'] } }).patterns!.orb).toBe(3);
  expect(parseAspectConfiguration({ patterns: { enabledTypes: ['Grand Trine'], orb: 5 } }).patterns!.orb).toBe(5);
});

test.each([
  [0, 2, 4, .2], [1, 0, 4, .2], [1, 2, 4, .05], [.5, 2, 4, .125],
  [1, 4, 4, 0], [1, 0, 0, .2],
])('renders weighting %s and deviation %s within tolerance %s at alpha %s', (weight, deviation, tolerance, expected) => {
  let view!: ReturnType<typeof create>;
  act(() => { view = create(<Probe base={.2} weight={weight} deviation={deviation} tolerance={tolerance} />); });
  const path = view.root.findAll(node => (node.type as unknown) === 'skPath')[0];
  const color = resolveColorValue({ source: 'hue', value: config.aspectOverlayStyle.aspectHues.trine, layer: 'primitive' }, theme);
  expect(path.props.color).toBe(withAlphaFactor(color, expected));
  act(() => view.unmount());
});
test('base zero hides fills, weighting off retains base, and source alpha is multiplied', () => {
  expect(patternFillOpacity(0, 1, 0, 0)).toBe(0);
  expect(patternFillOpacity(.08, 0, 5, 5)).toBe(.08);
  const style = { ...config.aspectOverlayStyle, patternOpacity: .2, patternOrbWeighting: 1, opacity: .9,
    colorMode: 'monochrome' as const, monochromeColor: { source: 'hex' as const, value: '#ff000080', layer: 'ic' as const } };
  expect(patternFillColor('Grand Trine', style, theme, 2, 4)).toBe(withAlphaFactor('#ff000080', .05));
});
