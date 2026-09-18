// Preserve the Swift app's elapsed-duration semantics, including 30-day months.
export const TIME_STEPS = [
  { label: '1 MIN', milliseconds: 60_000 },
  { label: '1 HOUR', milliseconds: 3_600_000 },
  { label: '1 DAY', milliseconds: 86_400_000 },
  { label: '1 WEEK', milliseconds: 604_800_000 },
  { label: '1 MONTH', milliseconds: 30 * 86_400_000 },
  { label: '1 YEAR', milliseconds: 365 * 86_400_000 },
] as const;

export const MIN_TIME = Date.UTC(1900, 0, 1);
export const MAX_TIME = Date.UTC(2100, 0, 1) - 1;

export function stepTime(time: number, unit: number, direction: -1 | 1) {
  return Math.max(MIN_TIME, Math.min(MAX_TIME, time + direction * TIME_STEPS[unit].milliseconds));
}

export function timeOffset(time: number, origin: number) {
  const difference = time - origin;
  if (Math.abs(difference) < 1000) return 'Now';
  const seconds = Math.round(Math.abs(difference) / 1000);
  const sign = difference < 0 ? '−' : '+';
  const units = [[86400, 'd'], [3600, 'h'], [60, 'm'], [1, 's']] as const;
  const [divisor, label] = units.find(([size]) => seconds >= size)!;
  return `${sign}${Number((seconds / divisor).toFixed(1))}${label}`;
}
