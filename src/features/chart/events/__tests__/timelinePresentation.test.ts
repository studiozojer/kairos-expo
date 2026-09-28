import { timelinePresentation, timelineCompensation, timelineDate, timelineFadeStops, TIMELINE_HEIGHT, TIMELINE_PITCH, TIMELINE_SLOT_WIDTH } from '../timelinePresentation';

test('step compensation preserves in-flight position through rapid steps and reversals', () => {
  expect(timelineCompensation(0, 1, false)).toBe(76);
  expect(timelineCompensation(25, 1, false)).toBe(101);
  expect(timelineCompensation(25, -1, false)).toBe(-51);
  expect(timelineCompensation(-25, -1, false)).toBe(-101);
  expect(timelineCompensation(-25, 1, false)).toBe(51);
});
test('settlement and reduced motion reset immediately instead of springing backwards', () => {
  expect(timelineCompensation(35, 0, false)).toBe(0);
  expect(timelineCompensation(35, 1, true)).toBe(0);
  expect(timelineCompensation(-35, -1, true)).toBe(0);
});
test('timeline fits existing control with native pitch and a 32-point fade', () => {
  expect([TIMELINE_HEIGHT, TIMELINE_SLOT_WIDTH, TIMELINE_PITCH]).toEqual([44, 44, 76]);
  expect(timelineFadeStops(200)).toEqual([0, .16, .84, 1]);
  expect(timelineFadeStops(50)).toEqual([0, .5, .5, 1]);
});
test('compact date reflects chart timezone across a local-day boundary', () => {
  const time = Date.parse('2024-01-01T01:00:00Z');
  expect(timelineDate(time, 'America/Los_Angeles')).toBe('12/31');
  expect(timelineDate(time, 'Asia/Tokyo')).toBe('01/01');
});


test('same-step preview arrivals freeze until settlement; rapid reversal adopts its own destination', () => {
  const a = { kind: 'origin' as const, id: 'a', time: 0 };
  const b = { kind: 'entry' as const, id: 'b', time: 1 };
  const oldSlots: import('../timelineTypes').TimelineSlots = [null, null, a, b, null];
  const destination: import('../timelineTypes').TimelineSlots = [null, a, b, null, null];
  const arrival: import('../timelineTypes').TimelineSlots = [a, a, b, b, null];
  const initial = { sequence: 0, slots: oldSlots, travelling: false };
  const moving = timelinePresentation(initial, destination, { sequence: 1, direction: 1 }, true, false);
  expect(moving.slots).toBe(destination); expect(moving.travelling).toBe(true);
  expect(timelinePresentation(moving, arrival, { sequence: 1, direction: 1 }, true, false)).toBe(moving);
  const reversed = timelinePresentation(moving, oldSlots, { sequence: 2, direction: -1 }, true, false);
  expect(reversed.slots).toBe(oldSlots); expect(reversed.travelling).toBe(true);
  expect(timelinePresentation(reversed, arrival, { sequence: 3, direction: 0 }, true, false).travelling).toBe(false);
  expect(timelinePresentation(moving, arrival, { sequence: 1, direction: 1 }, false, false).travelling).toBe(false);
  expect(timelinePresentation(moving, arrival, { sequence: 1, direction: 1 }, true, true).travelling).toBe(false);
});
