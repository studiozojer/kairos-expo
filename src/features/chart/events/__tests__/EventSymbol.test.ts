import { themeFor } from '@/theme';
import { eventSymbolStyle } from '../EventSymbol';
import { GLYPH_ASSETS } from '../../render/glyph-map.gen';
import { resolveColorValue } from '../../render/colors';
import { CHART_COLORS_DEFAULT } from '../../schema/core-types';
import { ASPECT_HUES_DEFAULT } from '../../schema/ring-styles';
import type { SkyEvent } from '../types';
import type { TimelineNode } from '../timelineTypes';

const theme = themeFor('dark');
const colors = { ...CHART_COLORS_DEFAULT, zodiacColors: { zodiacHues: { variant: 'minimal', signs: Array.from({ length: 12 }, () => 'green') } } };
const hues = { ...ASPECT_HUES_DEFAULT, conjunction: 'gold', opposition: 'purple' };
const node = (event: SkyEvent): TimelineNode => ({ id: 'test', kind: 'event', time: Date.parse(event.time), event });
const time = '2024-01-01T00:00:00Z';

test.each([
  ['Conjunction', 'aspects/conjunct', 'gold'], ['Opposition', 'aspects/opposite', 'purple'],
  ['Semisextile', 'aspects/semi-sextile', hues.semiSextile], ['Quincunx', 'aspects/quincunx', hues.quincunx],
  ['Sextile', 'aspects/sextile', hues.sextile], ['Square', 'aspects/square', hues.square], ['Trine', 'aspects/trine', hues.trine],
] as const)('%s uses the real aspect asset and primitive profile hue', (aspect, glyph, hue) => {
  const style = eventSymbolStyle(node({ kind: 'aspect', aspect, time, body: 'Venus', target: { type: 'fixed', id: 'sun', longitude: 0 }, residual_degrees: 0 }), colors, hues, theme);
  expect(style.glyph).toBe(glyph);
  expect(GLYPH_ASSETS[glyph]).toBeDefined();
  expect(style.color).toBe(resolveColorValue({ source: 'hue', value: hue, layer: 'primitive' }, theme));
  expect(style.dateColor).toBe(theme.color.txSecondary);
});
test('ingress uses profile sign hue despite minimal wheel variant, with retrograde date feedback', () => {
  const direct = eventSymbolStyle(node({ kind: 'ingress', body: 'Mercury', time, from_sign: 11, to_sign: 0 }), colors, hues, theme);
  expect(direct.glyph).toBe('signs/aries');
  expect(direct.color).toBe(resolveColorValue({ source: 'hue', value: 'green', layer: 'ic' }, theme));
  expect(direct.dateColor).toBe(theme.color.txSecondary);
  const retrograde = eventSymbolStyle(node({ kind: 'ingress', body: 'Mercury', time, from_sign: 0, to_sign: 11 }), colors, hues, theme);
  expect(retrograde.glyph).toBe('signs/pisces');
  expect(retrograde.dateColor).toBe(theme.color.icError);
});
test('station direction, origin and entry retain separate identities and colors', () => {
  for (const direction of ['direct', 'retrograde'] as const) {
    const style = eventSymbolStyle(node({ kind: 'station', body: 'Mercury', time, direction }), colors, hues, theme);
    expect(style.glyph).toBe(`other/station-${direction}`);
    expect(style.color).toBe(direction === 'direct' ? theme.color.icAccent : theme.color.icError);
  }
  for (const kind of ['origin', 'entry'] as const) {
    const style = eventSymbolStyle({ id: kind, kind, time: 0 }, colors, hues, theme);
    expect(style.marker).toBe(kind); expect(style.color).toBe(theme.color.icAccent); expect(style.dateColor).toBe(theme.color.icAccent);
  }
});
