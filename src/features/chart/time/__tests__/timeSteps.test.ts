import { MAX_TIME, MIN_TIME, stepTime, timeOffset } from '../timeSteps';

test('matches elapsed-time stepping across DST, month and leap-year boundaries', () => {
  const beforeDST = Date.parse('2026-03-07T12:00:00-08:00');
  expect(new Date(stepTime(beforeDST, 2, 1)).toISOString()).toBe('2026-03-08T20:00:00.000Z');
  expect(new Date(stepTime(Date.parse('2026-01-31T12:00:00Z'), 4, 1)).toISOString()).toBe('2026-03-02T12:00:00.000Z');
  expect(new Date(stepTime(Date.parse('2024-01-01T00:00:00Z'), 5, 1)).toISOString()).toBe('2024-12-31T00:00:00.000Z');
});

test('stops at supported date bounds and can step back from them', () => {
  expect(stepTime(MAX_TIME - 1000, 5, 1)).toBe(MAX_TIME);
  expect(stepTime(MIN_TIME + 1000, 5, -1)).toBe(MIN_TIME);
  expect(stepTime(MAX_TIME, 0, -1)).toBe(MAX_TIME - 60_000);
});

test('offset is signed and does not call a sub-minute change Now', () => {
  expect(timeOffset(0, 0)).toBe('Now');
  expect(timeOffset(86_400_000, 0)).toBe('+1d');
  expect(timeOffset(0, 3_600_000)).toBe('−1h');
  expect(timeOffset(30_000, 0)).toBe('+30s');
});
