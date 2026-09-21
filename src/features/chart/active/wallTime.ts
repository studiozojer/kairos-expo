import { MAX_TIME, MIN_TIME } from '../time/timeSteps';

function formatter(timezone: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, calendar: 'gregory', numberingSystem: 'latn',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
}
function parts(format: Intl.DateTimeFormat, time: number) {
  return Object.fromEntries(format.formatToParts(time).map(part => [part.type, part.value]));
}
export function localFields(time: number, timezone: string) {
  const p = parts(formatter(timezone), time);
  return { date: `${p.year}-${p.month}-${p.day}`, clock: `${p.hour}:${p.minute}:${p.second}` };
}
/** Every candidate must round-trip: nonexistent local times are never normalized. */
export function resolveWallTime(date: string, clock: string, timezone: string): number[] {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}(:\d{2})?$/.test(clock)) throw new Error('Use YYYY-MM-DD and HH:mm (24-hour time).');
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute, second = 0] = clock.split(':').map(Number);
  const wall = Date.UTC(year, month - 1, day, hour, minute, second);
  if (year < 1900 || year > 2099 || month < 1 || month > 12 || day < 1 || hour > 23 || minute > 59 || second > 59 ||
    new Date(wall).getUTCDate() !== day) throw new Error('Enter a valid date in 1900–2099 and a valid time.');
  let format: Intl.DateTimeFormat;
  try { format = formatter(timezone); } catch { throw new Error('Enter a valid IANA timezone, such as America/Los_Angeles.'); }
  const offsets = new Set<number>();
  // Sample either side of the local day to capture both offsets at transitions,
  // including half-hour changes and historical offsets with seconds.
  for (let delta = -48; delta <= 48; delta += 6) {
    const instant = wall + delta * 3_600_000;
    const p = parts(format, instant);
    offsets.add(Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - instant);
  }
  const candidates = [...offsets].map(offset => wall - offset).filter(time => {
    const p = parts(format, time);
    return +p.year === year && +p.month === month && +p.day === day && +p.hour === hour && +p.minute === minute && +p.second === second;
  }).sort((a, b) => a - b);
  if (!candidates.length) throw new Error('This local time does not exist because the clocks move forward. Choose another time.');
  if (candidates.some(time => time < MIN_TIME || time > MAX_TIME)) throw new Error('The UTC time must be within 1900–2099.');
  return candidates;
}
export function chartDateLabel(time: number, timezone: string) {
  return new Intl.DateTimeFormat(undefined, { timeZone: timezone, year: 'numeric', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', second: '2-digit', timeZoneName: 'short' }).format(time);
}
