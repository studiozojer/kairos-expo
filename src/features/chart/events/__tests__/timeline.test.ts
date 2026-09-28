import { EventTimelineCache, eventNode, timelineSlots } from '../timeline';
import { fetchEventWindow } from '../api';
import type { EventCapabilities, EventQuery, SkyEvent } from '../types';
import type { TimelineNode } from '../timelineTypes';
jest.mock('../api', () => ({ fetchEventWindow: jest.fn() }));
const fetchWindow = jest.mocked(fetchEventWindow);
const DAY = 86400000, anchor = 10 * DAY;
const query: EventQuery = { zodiac: 'tropical', bodies: ['Mercury'], kinds: ['station'], aspects: [] };
const cap: EventCapabilities = { schema_version: 1, available: true, supported_from: new Date(0).toISOString(), supported_to: new Date(200 * DAY).toISOString(), max_window_days: 1, max_events: 500, bodies: ['Mercury'], kinds: ['station'], aspects: [], modes: ['moving_moving'], zodiac: 'tropical', reason: 'available' };
const signal = () => new AbortController().signal;
const event = (time: number, direction: 'direct' | 'retrograde' = 'direct'): SkyEvent => ({ kind: 'station', body: 'Mercury', time: new Date(time).toISOString(), direction });
function windows(events: SkyEvent[] = []) {
  fetchWindow.mockImplementation(async (_query, from, to) => ({ schema_version: 1, coverage_complete: true, from: new Date(from).toISOString(), to: new Date(to).toISOString(), events: events.filter(e => Date.parse(e.time) >= from && Date.parse(e.time) < to).sort((a, b) => Date.parse(a.time) - Date.parse(b.time)) }));
}
beforeEach(() => { fetchWindow.mockReset(); });

test('adjacent searches reuse complete grid coverage and preserve subsecond events', async () => {
  const events = [event(anchor + 500), event(anchor + 2000), event(anchor + DAY)];
  windows(events);
  const cache = new EventTimelineCache(query, cap);
  expect((await cache.search(anchor, 1, signal())).event).toEqual(events[0]);
  expect((await cache.search(anchor + 500, 1, signal(), true)).event).toEqual(events[1]);
  expect(fetchWindow).toHaveBeenCalledTimes(1);
  expect((await cache.search(anchor + 2000, 1, signal(), true)).event).toEqual(events[2]);
  expect(fetchWindow).toHaveBeenCalledTimes(2);
  expect(cache.events).toEqual(events);
});

test('backward grid boundary uses the left tile; forward includes boundary', async () => {
  windows([event(anchor), event(anchor - 500), event(anchor - DAY)]);
  const cache = new EventTimelineCache(query, cap);
  expect((await cache.search(anchor, -1, signal())).event).toEqual(event(anchor - 500));
  expect(fetchWindow.mock.calls[0].slice(1, 3)).toEqual([anchor - DAY, anchor]);
  expect((await cache.search(anchor, 1, signal())).event).toEqual(event(anchor));
  expect((await cache.search(anchor, -1, signal(), true)).event).toEqual(event(anchor - DAY));
});

test('never jumps an uncovered gap to a cached distant event', async () => {
  windows([event(anchor + 5 * DAY + 1000), event(anchor + DAY + 1000)]);
  const cache = new EventTimelineCache(query, cap);
  await cache.search(anchor + 5 * DAY, 1, signal());
  const result = await cache.search(anchor, 1, signal(), false, 1);
  expect(result).toEqual({ event: null, boundary: anchor + DAY, exhausted: false });
  expect((await cache.search(result.boundary, 1, signal(), false, 1)).event).toEqual(event(anchor + DAY + 1000));
});

test('new request budget does not count cached coverage, including empty windows', async () => {
  windows();
  const cache = new EventTimelineCache(query, cap);
  expect(await cache.search(anchor, 1, signal(), false, 2)).toEqual({ event: null, boundary: anchor + 2 * DAY, exhausted: false });
  expect(await cache.search(anchor, 1, signal(), false, 1)).toEqual({ event: null, boundary: anchor + 3 * DAY, exhausted: false });
  expect(fetchWindow).toHaveBeenCalledTimes(3);
  await cache.search(anchor, 1, signal(), false, 0);
  expect(fetchWindow).toHaveBeenCalledTimes(3);
});

test('clips tiles to supported range, reporting exhausted only at its edges', async () => {
  windows();
  const cache = new EventTimelineCache(query, { ...cap, supported_from: new Date(anchor - 500).toISOString(), supported_to: new Date(anchor + 500).toISOString() });
  expect(await cache.search(anchor, 1, signal())).toEqual({ event: null, boundary: anchor + 500, exhausted: true });
  expect(await cache.search(anchor, -1, signal())).toEqual({ event: null, boundary: anchor - 500, exhausted: true });
  expect(fetchWindow.mock.calls.map(call => call.slice(1, 3))).toEqual([[anchor, anchor + 500], [anchor - 500, anchor]]);
});

test('cancelled late responses never enter cache; subsequent query fetches again', async () => {
  let resolve!: (result: Awaited<ReturnType<typeof fetchEventWindow>>) => void;
  fetchWindow.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  const controller = new AbortController(), cache = new EventTimelineCache(query, cap);
  const pending = cache.search(anchor, 1, controller.signal);
  controller.abort();
  resolve({ schema_version: 1, coverage_complete: true, from: new Date(anchor).toISOString(), to: new Date(anchor + DAY).toISOString(), events: [event(anchor + 500)] });
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  expect(cache.events).toEqual([]);
  windows([event(anchor + 500)]);
  await cache.search(anchor, 1, signal());
  expect(fetchWindow).toHaveBeenCalledTimes(2);
});

test('failed windows are not cached', async () => {
  fetchWindow.mockRejectedValueOnce(new Error('partial coverage'));
  const cache = new EventTimelineCache(query, cap);
  await expect(cache.search(anchor, 1, signal())).rejects.toThrow('partial coverage');
  windows([event(anchor + 500)]);
  await cache.search(anchor, 1, signal());
  expect(fetchWindow).toHaveBeenCalledTimes(2);
});

test('bounded cache evicts distant windows and requires covering their gaps again', async () => {
  windows(Array.from({ length: 60 }, (_, i) => event(i * DAY + 500)));
  const cache = new EventTimelineCache(query, cap);
  for (let i = 0; i < 60; i++) await cache.search(i * DAY, 1, signal());
  expect(cache.events).toHaveLength(48);
  expect(cache.events[0]).toEqual(event(12 * DAY + 500));
  await cache.search(0, 1, signal());
  expect(fetchWindow).toHaveBeenCalledTimes(61);
  expect(cache.events).toHaveLength(48);
});

test('simultaneous events resolve to same deterministic stop in both directions', async () => {
  windows([event(anchor + 500, 'retrograde'), event(anchor + 500, 'direct')]);
  const cache = new EventTimelineCache(query, cap);
  const forward = await cache.search(anchor, 1, signal());
  const backward = await cache.search(anchor + 1000, -1, signal());
  expect(forward.event).toEqual(backward.event);
  expect(eventNode(forward.event!).id).toBe(eventNode(backward.event!).id);
});

test('five slots choose nearest two sides, collapse exact ties and prefer events then origin', () => {
  const marker = (time: number, kind: 'origin' | 'entry'): TimelineNode => ({ id: kind, time, kind });
  const nodes: TimelineNode[] = [marker(10, 'entry'), marker(10, 'origin'), eventNode(event(10)), eventNode(event(10, 'retrograde')), marker(20, 'entry'), marker(20, 'origin'), ...[0, 5, 30, 40, 50].map(t => eventNode(event(t)))];
  const slots = timelineSlots(nodes.reverse(), 10);
  expect(slots.map(node => node?.time)).toEqual([0, 5, 10, 20, 30]);
  expect(slots[2]?.kind).toBe('event');
  expect(slots[3]?.kind).toBe('origin');
  expect(timelineSlots(nodes, 11)[2]?.time).toBe(10);
  expect(timelineSlots([], 100)).toEqual([null, null, null, null, null]);
});

test('event identity does not change with residual rounding or object property order', () => {
  const aspect: SkyEvent = { kind: 'aspect', body: 'Mercury', time: new Date(anchor).toISOString(), aspect: 'Square', target: { type: 'fixed', id: 'natal.Sun', longitude: 123 }, residual_degrees: .001 };
  expect(eventNode(aspect).id).toBe(eventNode({ ...aspect, residual_degrees: .002 }).id);
});

test('visible neighbors include only uninterrupted cached coverage around time', async () => {
  windows([event(anchor + 500), event(anchor + DAY + 500), event(anchor + 3 * DAY + 500)]);
  const cache = new EventTimelineCache(query, cap);
  await cache.search(anchor, 1, signal());
  await cache.search(anchor + DAY, 1, signal());
  await cache.search(anchor + 3 * DAY, 1, signal());
  expect(cache.events).toHaveLength(3);
  expect(cache.eventsAround(anchor)).toEqual([event(anchor + 500), event(anchor + DAY + 500)]);
  expect(cache.eventsAround(anchor + 2 * DAY)).toEqual([event(anchor + 500), event(anchor + DAY + 500)]);
  expect(cache.eventsAround(anchor + 2 * DAY + 500)).toEqual([]);
  expect(cache.eventsAround(anchor + 3 * DAY)).toEqual([event(anchor + 3 * DAY + 500)]);
  await cache.search(anchor + 2 * DAY, 1, signal());
  expect(cache.eventsAround(anchor)).toEqual(cache.events);
});
