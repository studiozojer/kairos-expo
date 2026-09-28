import type { SkyEvent } from './types';
export type TimelineNode = { id: string; time: number } & (
  { kind: 'event'; event: SkyEvent } | { kind: 'origin' | 'entry' }
);
export type TimelineSlots = [TimelineNode | null, TimelineNode | null, TimelineNode | null, TimelineNode | null, TimelineNode | null];
export interface TimelineTransition { sequence: number; direction: -1 | 0 | 1 }
