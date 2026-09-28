export const STEP_WIDTH = 100;
// Swift rounds half away from zero; JS Math.round differs for negative halves.
function round(value: number) { 'worklet'; return Math.sign(value) * Math.floor(Math.abs(value) + .5); }
export function previewUnit(unit: number, translation: number, count: number): number | null {
  'worklet';
  const delta = round(translation / STEP_WIDTH), next = unit - delta;
  return delta !== 0 && next >= 0 && next < count ? next : null;
}
export function resistedOffset(unit: number, translation: number, count: number) {
  'worklet';
  return (unit === 0 && translation > 0) || (unit === count - 1 && translation < 0) ? translation * .2 : translation;
}
export function releasedUnit(unit: number, x: number, y: number, velocity: number, count: number) {
  'worklet';
  if (Math.abs(velocity) > 300 && Math.abs(x) > Math.abs(y)) {
    const steps = Math.max(1, round(Math.abs(x) / STEP_WIDTH * (1 + Math.min(Math.abs(velocity) / 2000, 2))));
    return Math.max(0, Math.min(count - 1, unit + (velocity > 0 ? -steps : steps)));
  }
  return previewUnit(unit, x, count) ?? unit;
}
