/** Equal-width occupied slots, in innermost-first order. Padding and the Add
 * button live outside this coordinate space. Invalid drops cancel, never evict. */
export function cardSlotAt(x: number, y: number, width: number, height: number, count: number): number {
  'worklet';
  if (count < 1 || width <= 0 || x < 0 || x > width || y < 0 || y > height) return -1;
  return Math.min(count - 1, Math.floor(x / (width / count)));
}
export function slotCardWidth(width: number, count: number, gap: number) {
  'worklet';
  return count > 0 ? Math.max(0, (width - gap * (count - 1)) / count) : 0;
}
