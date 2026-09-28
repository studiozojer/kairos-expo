/** Public sky-service v1 contract. Times are UTC; event windows are half-open. */
export const EVENT_BODIES = ['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'] as const;
export const EVENT_ASPECTS = ['Conjunction', 'Semisextile', 'Sextile', 'Square', 'Trine', 'Quincunx', 'Opposition'] as const;
export type EventBody = typeof EVENT_BODIES[number];
export type EventAspect = typeof EVENT_ASPECTS[number];
export type EventKind = 'aspect' | 'ingress' | 'station';
export interface FixedPoint { id: string; longitude: number }
export interface EventQuery {
  zodiac: 'tropical'; bodies: EventBody[]; kinds: EventKind[]; aspects: EventAspect[]; fixed_points?: FixedPoint[];
}
export interface EventCapabilities {
  schema_version: 1; available: boolean; supported_from: string; supported_to: string;
  max_window_days: number; max_events: number; bodies: EventBody[]; aspects: EventAspect[];
  kinds: EventKind[]; modes: string[]; zodiac: string; reason: string;
}
export type SkyEvent = { time: string; body: EventBody } & (
  { kind: 'aspect'; aspect: EventAspect; target: { type: 'moving'; body: EventBody } | { type: 'fixed'; id: string; longitude: number }; residual_degrees: number }
  | { kind: 'ingress'; from_sign: number; to_sign: number }
  | { kind: 'station'; direction: 'direct' | 'retrograde' }
);
export interface EventWindow { schema_version: 1; from: string; to: string; coverage_complete: true; events: SkyEvent[] }
export interface EventMode { key: string; label: string; kind: 'aspect' | 'motion'; query: EventQuery }
export interface EventSearchResult { event: SkyEvent | null; boundary: number; exhausted: boolean }
