import type { ChartRenderingConfiguration } from '../config/ChartRenderingConfiguration';
import type { Placement } from '../config/engine-types';
import type { SelectionStyleOverride } from '../schema/preset';
import { ZODIAC_SIGNS } from '../schema/enums.gen';
import type { WheelLayout } from '../render/useWheelLayout';
import { toCanvas, type Point, type WheelTransform } from './motion';

export interface ChartTarget extends Point {
  id: string; kind: 'body' | 'sign' | 'house'; label: string; detail: string;
  radius: number; placement?: Placement;
}
export function chartTargets(layout: WheelLayout): ChartTarget[] {
  const out: ChartTarget[] = [];
  layout.rings.forEach((ring, index) => {
    const radius = layout.global.moduleHitRadiusOverrides[
      ring.type.kind === 'planets' ? 'planetsRing' : ring.type.kind === 'zodiacSigns' ? 'zodiacRing' : 'housesRing'
    ] ?? layout.global.defaultHitRadius;
    if (ring.type.kind === 'planets') {
      for (const pos of layout.planetLayouts.get(index) ?? []) {
        const p = pos.placement;
        const degrees = ((p.longitude % 30) + 30) % 30;
        out.push({ id: p.id, kind: 'body', label: p.bodyName, placement: p, ...pos.adjustedPosition, radius,
          detail: `${Math.floor(degrees)}° ${String(Math.floor((degrees % 1) * 60)).padStart(2, '0')}′ ${p.signPlacement}${p.housePlacement ? ` · House ${p.housePlacement}` : ''}${p.isRetrograde ? ' · Retrograde' : ''}` });
      }
    } else if (ring.type.kind === 'zodiacSigns') {
      ZODIAC_SIGNS.forEach((sign, i) => out.push({ id: `sign:${sign}`, kind: 'sign', label: sign[0].toUpperCase() + sign.slice(1),
        detail: `${i * 30}°–${(i + 1) * 30}°`, radius,
        ...layout.coordinates.pointForDegree(i * 30 + 15, layout.geometry.midRadiusForRing(index)) }));
    } else if (ring.type.kind === 'houseNumbers') {
      layout.houseCusps.forEach((cusp, i) => out.push({ id: `house:${i + 1}`, kind: 'house', label: `House ${i + 1}`,
        detail: `Cusp ${cusp.toFixed(2)}°`, radius,
        ...layout.coordinates.pointForDegree(layout.coordinates.calculateMidpoint(cusp, layout.houseCusps[(i + 1) % 12]), layout.geometry.midRadiusForRing(index)) }));
    }
  });
  return out;
}
export function hitTarget(targets: ChartTarget[], point: Point, transform: WheelTransform, size: number): string | null {
  'worklet'; const canvas = toCanvas(point, transform, size);
  let closest = Infinity, id: string | null = null;
  for (const target of targets) {
    const distance = Math.hypot(canvas.x - target.x, canvas.y - target.y);
    if (distance <= target.radius && distance < closest) { closest = distance; id = target.id; }
  }
  return id;
}
export function toggleSelection(ids: string[], id: string | null): string[] {
  if (id === null) return [];
  return ids.includes(id) ? ids.filter(value => value !== id) : [...ids, id];
}
export interface SelectionPaint {
  selected: ReadonlySet<string>; related: ReadonlySet<string>; style: SelectionStyleOverride;
}
export function selectionPaint(ids: string[], targets: ChartTarget[], config: ChartRenderingConfiguration, style: SelectionStyleOverride): SelectionPaint {
  const selected = new Set(ids.filter(id => targets.some(t => t.id === id))), related = new Set<string>();
  for (const target of targets) {
    if (!selected.has(target.id) || !target.placement) continue;
    const p = target.placement;
    related.add(`sign:${p.signPlacement.toLowerCase()}`);
    if (p.housePlacement) related.add(`house:${p.housePlacement}`);
    if (style.includeAspectedPlanets) {
      // iOS RelationshipComputer uses the chart's aspect edges for this tier.
      for (const edge of config.aspectEdges) {
        if (edge.from === p.id) related.add(edge.to);
        if (edge.to === p.id) related.add(edge.from);
      }
    }
  }
  // Fixed-star and rulership-ring relationships remain inert until those rings
  // are rendered, matching iOS's presence-gated relationship computation.
  return { selected, related, style };
}
export type SelectionElement = 'affectsGlyphs' | 'affectsDegreeText' | 'affectsDegreeMarks' | 'affectsHouseNumbers' | 'affectsCuspLines';
export function selectionOpacity(paint: SelectionPaint | undefined, id: string, element: SelectionElement, zodiac = false) {
  if (!paint || !paint.selected.size || !paint.style[element] || (zodiac && paint.style.ignoreZodiacRingOpacity)) return 1;
  if (paint.selected.has(id)) return 1;
  return paint.related.has(id) ? paint.style.relatedOpacity : paint.style.unselectedOpacity;
}
