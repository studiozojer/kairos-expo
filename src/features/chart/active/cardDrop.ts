import { cardSlotAt } from './cardSlots';

export type WindowRect = { x: number; y: number; width: number; height: number };
export type CardDrop = { kind: 'remove'; id: string } | { kind: 'reorder'; id: string; targetId: string } | { kind: 'cancel' };

/** The finger, not the card's center or the trash icon, arms put-away. */
export function isPutAwayPoint(x: number, y: number, viewport: WindowRect): boolean {
  'worklet';
  return viewport.width > 0 && viewport.height > 0 && x >= viewport.x && x <= viewport.x + viewport.width
    && y > viewport.y + viewport.height / 2 && y <= viewport.y + viewport.height;
}

export function resolveCardDrop(id: string, ids: string[], x: number, y: number, viewport: WindowRect, row: WindowRect): CardDrop {
  'worklet';
  if (!ids.includes(id)) return { kind: 'cancel' };
  if (isPutAwayPoint(x, y, viewport)) return { kind: 'remove', id };
  const slot = cardSlotAt(x - row.x, y - row.y, row.width, row.height, ids.length);
  return slot >= 0 && ids[slot] !== id ? { kind: 'reorder', id, targetId: ids[slot] } : { kind: 'cancel' };
}

/** Swift's circle bottom is 200pt up. Short viewports keep the circle fully
 * inside the lower half and above the stepper when there is room. */
export function putAwayCenter(height: number, stepperTop: number): number {
  const lower = height / 2 + 35;
  const upper = Math.max(lower, Math.min(height - 35, stepperTop - 47));
  return Math.min(upper, Math.max(lower, height - 235));
}
