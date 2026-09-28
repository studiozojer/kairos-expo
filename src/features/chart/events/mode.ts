import type { Placement } from '../config/engine-types';
import type { EventCapabilities, EventMode, EventBody, EventAspect } from './types';
import { EVENT_BODIES, EVENT_ASPECTS } from './types';

/** Only bodies in the explicitly targeted instance move. Ring numbers never
 * confer time ownership; a fixed endpoint can be any calculated placement. */
export function eventMode(placements: Placement[], selectedIds: string[], targetId: string | null,
  enabledAspects: string[]): EventMode | null {
  const selected = [...new Set(selectedIds)].flatMap(id => {
    const p = placements.find(item => item.id === id); return p ? [p] : [];
  }).sort((a, b) => a.id.localeCompare(b.id));
  if (!targetId || !selected.length || selected.length > 2) return null;
  const moving = selected.filter(p => p.chartInstanceId === targetId);
  if (!moving.length || moving.some(p => !EVENT_BODIES.includes(p.bodyName as EventBody))) return null;
  if (selected.length === 1) {
    const body = moving[0].bodyName as EventBody;
    const query = { zodiac: 'tropical' as const, bodies: [body], kinds: ['ingress', 'station'] as ('ingress' | 'station')[], aspects: [] };
    return { kind: 'motion', label: `${body} · motion`, key: JSON.stringify([targetId, selected.map(p => p.id), query]), query };
  }
  const aspects = EVENT_ASPECTS.filter(aspect => enabledAspects.includes(aspect)) as EventAspect[];
  if (!aspects.length) return null;
  const fixed = selected.find(p => p.chartInstanceId !== targetId);
  if (fixed && (!fixed.chartInstanceId || !Number.isFinite(fixed.longitude))) return null;
  const query = { zodiac: 'tropical' as const, bodies: moving.map(p => p.bodyName as EventBody),
    kinds: ['aspect'] as ['aspect'], aspects,
    // Server IDs are bounded ASCII. Stable selection identity remains in key;
    // this request has exactly one fixed point, so a short wire ID suffices.
    ...(fixed ? { fixed_points: [{ id: 'fixed', longitude: fixed.longitude >= 0 && fixed.longitude < 360 ? fixed.longitude : ((fixed.longitude % 360) + 360) % 360 }] } : {}),
  };
  return { kind: 'aspect', label: selected.map(p => `${p.bodyName}${fixed ? ` (${p.chartName ?? 'Chart'})` : ''}`).join(' · '),
    key: JSON.stringify([targetId, selected.map(p => p.id), query]), query };
}
export function supportsMode(capabilities: EventCapabilities, mode: EventMode, time: number): boolean {
  return capabilities.available && capabilities.schema_version === 1 && capabilities.zodiac === 'tropical' &&
    time >= Date.parse(capabilities.supported_from) && time < Date.parse(capabilities.supported_to) &&
    mode.query.bodies.every(body => capabilities.bodies.includes(body)) &&
    mode.query.kinds.every(kind => capabilities.kinds.includes(kind)) &&
    mode.query.aspects.every(aspect => capabilities.aspects.includes(aspect)) &&
    (mode.kind !== 'aspect' || capabilities.modes.includes(mode.query.fixed_points ? 'moving_fixed' : 'moving_moving'));
}
