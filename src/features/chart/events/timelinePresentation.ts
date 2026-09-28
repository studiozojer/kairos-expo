import type { TimelineTransition } from './timelineTypes';
export const TIMELINE_HEIGHT = 44;
export const TIMELINE_SLOT_WIDTH = 44;
export const TIMELINE_PITCH = 76;
export const TIMELINE_EDGE_FADE = 32;
/** New slots have shifted one pitch: carry the interrupted presentation offset. */
export function timelineCompensation(residual: number, direction: TimelineTransition['direction'], reducedMotion: boolean): number {
  'worklet';
  return reducedMotion || direction === 0 ? 0 : residual + direction * TIMELINE_PITCH;
}
export function timelineDate(time: number, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: timezone, month: '2-digit', day: '2-digit' }).format(time);
}
export function timelineFadeStops(width: number): number[] {
  const fraction = Math.min(.5, TIMELINE_EDGE_FADE / Math.max(1, width));
  return [0, fraction, 1 - fraction, 1];
}

/** Preview arrivals cannot rearrange a row while that row is travelling. */
export interface TimelinePresentation {
  sequence: number; slots: import('./timelineTypes').TimelineSlots; travelling: boolean;
}
export function timelinePresentation(previous: TimelinePresentation, slots: import('./timelineTypes').TimelineSlots, transition: TimelineTransition, enabled: boolean, reducedMotion: boolean): TimelinePresentation {
  const moving = enabled && !reducedMotion && transition.direction !== 0;
  if (transition.sequence !== previous.sequence) return { sequence: transition.sequence, slots, travelling: moving };
  if (previous.travelling && !moving) return { sequence: transition.sequence, slots, travelling: false };
  return previous;
}
