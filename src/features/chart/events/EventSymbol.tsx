import { Path } from '@shopify/react-native-skia';
import type { Theme } from '@/theme';
import { Glyph } from '../render/Glyph';
import type { GlyphName } from '../render/glyph-map.gen';
import { resolveColorValue } from '../render/colors';
import type { ChartColors } from '../schema/core-types';
import type { AspectHues } from '../schema/ring-styles';
import type { EventAspect } from './types';
import type { TimelineNode } from './timelineTypes';

const ASPECTS: Record<EventAspect, { glyph: GlyphName; hue: keyof AspectHues }> = {
  Conjunction: { glyph: 'aspects/conjunct', hue: 'conjunction' },
  Semisextile: { glyph: 'aspects/semi-sextile', hue: 'semiSextile' },
  Quincunx: { glyph: 'aspects/quincunx', hue: 'quincunx' },
  Sextile: { glyph: 'aspects/sextile', hue: 'sextile' },
  Square: { glyph: 'aspects/square', hue: 'square' },
  Trine: { glyph: 'aspects/trine', hue: 'trine' },
  Opposition: { glyph: 'aspects/opposite', hue: 'opposition' },
};
const SIGNS = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'] as const;
export interface EventSymbolStyle { glyph?: GlyphName; marker?: 'origin' | 'entry'; color: string; dateColor: string }
/** Mirrors iOS icon providers: event hues ignore wheel glyph variants. */
export function eventSymbolStyle(node: TimelineNode, colors: ChartColors, aspectHues: AspectHues, theme: Theme): EventSymbolStyle {
  if (node.kind !== 'event') return { marker: node.kind, color: theme.color.icAccent, dateColor: theme.color.icAccent };
  const event = node.event;
  if (event.kind === 'station') return {
    glyph: event.direction === 'direct' ? 'other/station-direct' : 'other/station-retrograde',
    color: event.direction === 'direct' ? theme.color.icAccent : theme.color.icError, dateColor: theme.color.txSecondary,
  };
  if (event.kind === 'ingress') return {
    glyph: `signs/${SIGNS[event.to_sign]}` as GlyphName,
    color: resolveColorValue({ source: 'hue', value: colors.zodiacColors.zodiacHues.signs[event.to_sign] ?? 'red', layer: 'ic' }, theme),
    dateColor: (event.to_sign + 1) % 12 === event.from_sign ? theme.color.icError : theme.color.txSecondary,
  };
  const aspect = ASPECTS[event.aspect], hue = aspectHues[aspect.hue];
  return { glyph: aspect.glyph, color: hue === 'greyscale' ? theme.color.icPrimary : resolveColorValue({ source: 'hue', value: hue, layer: 'primitive' }, theme), dateColor: theme.color.txSecondary };
}

/** Skia-only child. Origin and entry are distinct SF-symbol-shaped vectors. */
export function EventSymbol({ style, x, y }: { style: EventSymbolStyle; x: number; y: number }) {
  if (style.glyph) return <Glyph name={style.glyph} size={28} color={style.color} x={x} y={y} />;
  if (style.marker === 'entry') return <Path path={`M ${x - 9} ${y - 1} L ${x + 9} ${y - 9} L ${x + 1} ${y + 9} L ${x - 1} ${y + 1} Z`} color={style.color} />;
  return <Path path={`M ${x} ${y - 9} L ${x} ${y + 4} M ${x - 5} ${y - 1} L ${x} ${y + 4} L ${x + 5} ${y - 1} M ${x - 8} ${y + 9} L ${x + 8} ${y + 9}`} color={style.color} style="stroke" strokeWidth={1.8} strokeCap="round" strokeJoin="round" />;
}
