import React from 'react';
import { act, create } from 'react-test-renderer';
import { themeFor } from '@/theme';
import { buildConfiguration } from '../../config/buildConfiguration';
import chart from '../../fixtures/engine/seattle-2026.json';
import { bundledPreset } from '../../display/presets';
import { PatternOverlay, patternFillColor } from '../PatternOverlay';
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
function Probe({ selected = false, enabled = true, show = true }) {
  const cfg = { ...config, aspects: { ...config.aspects, enabled, showPatterns: show } };
  const layout = useWheelLayout(cfg, 400);
  return <ChartPaintProvider value={theme}><PatternOverlay config={cfg} layout={layout} hasSelection={selected} /></ChartPaintProvider>;
}
test('draws one fill with no outline, and yields to selection and aspect visibility', () => {
  let view: ReturnType<typeof create>;
  act(() => { view = create(<Probe />); });
  const paths = () => view!.root.findAll(node => (node.type as unknown) === 'skPath');
  expect(paths()).toHaveLength(1);
  expect(paths()[0].props.style).toBe('fill');
  for (const props of [{ selected: true }, { enabled: false }, { show: false }]) {
    act(() => view!.update(<Probe {...props} />));
    expect(paths()).toHaveLength(0);
  }
  act(() => view!.update(<Probe />));
  expect(paths()).toHaveLength(1);
  act(() => view!.unmount());
});
