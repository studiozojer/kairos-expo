import { fetchEventCapabilities, fetchEventWindow, findEvent } from '../api';
import type { EventCapabilities, EventQuery, SkyEvent } from '../types';
const DAY = 86400000, anchor = Date.parse('2026-01-01T00:00:00Z');
const query: EventQuery = { zodiac: 'tropical', bodies: ['Mercury'], kinds: ['station'], aspects: [] };
const cap: EventCapabilities = { schema_version: 1, available: true, supported_from: '1900-02-04T00:00:00Z', supported_to: '2199-11-28T00:00:00Z', max_window_days: 31, max_events: 500, bodies: ['Mercury'], kinds: ['station'], aspects: [], modes: ['moving_moving'], zodiac: 'tropical', reason: 'available' };
const station = (time: number): SkyEvent => ({ kind: 'station', time: new Date(time).toISOString(), body: 'Mercury', direction: 'direct' });
const response = (data: unknown) => ({ ok: true, json: async () => data }) as Response;
let fetchMock: jest.Mock;
const signal = () => new AbortController().signal;
function windows(events: SkyEvent[] = []) {
  fetchMock.mockImplementation(async (_url, init) => {
    const { from, to } = JSON.parse(init.body);
    return response({ schema_version: 1, coverage_complete: true, from, to, events: events.filter(e => e.time >= from && e.time < to) });
  });
}
beforeEach(() => { fetchMock = jest.fn(); global.fetch = fetchMock; });
afterEach(() => jest.useRealTimers());

test('disabled capability need not include supported fields; unknown schema rejected', async () => {
  fetchMock.mockResolvedValueOnce(response({ schema_version: 1, available: false })).mockResolvedValueOnce(response({ ...cap, schema_version: 2 }));
  expect((await fetchEventCapabilities(signal())).available).toBe(false);
  await expect(fetchEventCapabilities(signal())).rejects.toThrow('incompatible');
});

test('public request validates capabilities, has no authorization, and aborts promptly', async () => {
  fetchMock.mockResolvedValueOnce(response(cap));
  await expect(fetchEventCapabilities(signal())).resolves.toEqual(cap);
  expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
  fetchMock.mockImplementation(() => new Promise(() => {}));
  const controller = new AbortController();
  const pending = fetchEventCapabilities(controller.signal);
  controller.abort();
  await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  expect(fetchMock.mock.calls[1][1].signal.aborted).toBe(true);
});

test('timeout covers a stalled response decoder even when transport ignores abort', async () => {
  jest.useFakeTimers();
  fetchMock.mockResolvedValue({ ok: true, json: () => new Promise(() => {}) });
  const pending = fetchEventCapabilities(signal());
  const assertion = expect(pending).rejects.toThrow('too long');
  await jest.advanceTimersByTimeAsync(8000);
  await assertion;
  expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
});

test.each([
  { coverage_complete: false }, { schema_version: 2 }, { from: '2026-01-02T00:00:00Z' },
  { events: [station(anchor + 5000), station(anchor + 2000)] },
  { events: [{ ...station(anchor + 5000), body: 'Venus' }] },
  { events: [station(anchor + DAY)] },
])('rejects incompatible, partial, unordered or mismatched windows: %p', async change => {
  fetchMock.mockResolvedValue(response({ schema_version: 1, coverage_complete: true, from: new Date(anchor).toISOString(), to: new Date(anchor + DAY).toISOString(), events: [], ...change }));
  await expect(fetchEventWindow(query, anchor, anchor + DAY, signal())).rejects.toThrow('incompatible');
});

test('finds nearest on either side, excluding current event tolerance', async () => {
  windows([station(anchor - 9000), station(anchor - 3000), station(anchor - 500), station(anchor), station(anchor + 500), station(anchor + 3000), station(anchor + 9000)]);
  expect((await findEvent(query, anchor, 1, cap, signal())).event).toEqual(station(anchor + 3000));
  expect((await findEvent(query, anchor, -1, cap, signal())).event).toEqual(station(anchor - 3000));
});

test('adjacent windows include their exact shared boundary without gap', async () => {
  windows([station(anchor + 31 * DAY)]);
  expect((await findEvent(query, anchor, 1, cap, signal())).event).toEqual(station(anchor + 31 * DAY));
  expect(fetchMock).toHaveBeenCalledTimes(2);
  const first = JSON.parse(fetchMock.mock.calls[0][1].body), second = JSON.parse(fetchMock.mock.calls[1][1].body);
  expect(first.to).toBe(second.from);
  windows([station(anchor - 31 * DAY)]);
  expect((await findEvent(query, anchor, -1, cap, signal())).event).toEqual(station(anchor - 31 * DAY));
});

test('empty search is bounded at twelve windows, continuation includes exact boundary', async () => {
  windows();
  const empty = await findEvent(query, anchor, 1, cap, signal());
  expect(empty).toEqual({ event: null, boundary: anchor + 12 * 31 * DAY, exhausted: false });
  expect(fetchMock).toHaveBeenCalledTimes(12);
  windows([station(empty.boundary)]);
  expect((await findEvent(query, empty.boundary, 1, cap, signal(), false)).event).toEqual(station(empty.boundary));
});

test('clips searches to service range and distinguishes exhausted from network failure', async () => {
  windows();
  const limited = { ...cap, supported_to: new Date(anchor + DAY).toISOString() };
  expect(await findEvent(query, anchor, 1, limited, signal())).toEqual({ event: null, boundary: anchor + DAY, exhausted: true });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  fetchMock.mockRejectedValue(new Error('offline'));
  await expect(findEvent(query, anchor, 1, limited, signal())).rejects.toMatchObject({ kind: 'network' });
});

test('unsupported query and pre-aborted search never contact server', async () => {
  await expect(findEvent({ ...query, bodies: ['Sun'] }, anchor, 1, cap, signal())).rejects.toThrow('not supported');
  const controller = new AbortController(); controller.abort();
  await expect(findEvent(query, anchor, 1, cap, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  expect(fetchMock).not.toHaveBeenCalled();
});

test('cross-chart responses must match the fixed identity and longitude', async () => {
  const fixedQuery: EventQuery = { zodiac: 'tropical', bodies: ['Mercury'], kinds: ['aspect'], aspects: ['Square'], fixed_points: [{ id: 'natal.Sun', longitude: 123 }] };
  const event = { kind: 'aspect', body: 'Mercury', time: new Date(anchor + 2000).toISOString(), aspect: 'Square', target: { type: 'fixed', id: 'natal.Sun', longitude: 123 }, residual_degrees: 0.0001 };
  const result = { schema_version: 1, coverage_complete: true, from: new Date(anchor).toISOString(), to: new Date(anchor + DAY).toISOString(), events: [event] };
  fetchMock.mockResolvedValueOnce(response(result)).mockResolvedValueOnce(response({ ...result, events: [{ ...event, target: { ...event.target, longitude: 124 } }] }));
  await expect(fetchEventWindow(fixedQuery, anchor, anchor + DAY, signal())).resolves.toEqual(result);
  await expect(fetchEventWindow(fixedQuery, anchor, anchor + DAY, signal())).rejects.toThrow('incompatible');
});

test('events use 45-second timeout and searches stop after cancellation between windows', async () => {
  jest.useFakeTimers();
  fetchMock.mockImplementation(() => new Promise(() => {}));
  const pending = fetchEventWindow(query, anchor, anchor + DAY, signal());
  const assertion = expect(pending).rejects.toThrow('too long');
  await jest.advanceTimersByTimeAsync(45_000); await assertion;
  const controller = new AbortController();
  fetchMock.mockImplementation(async (_url, init) => {
    const { from, to } = JSON.parse(init.body); controller.abort();
    return response({ schema_version: 1, coverage_complete: true, from, to, events: [] });
  });
  await expect(findEvent(query, anchor, 1, cap, controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test.each(['busy', 'computation_unavailable', 'unavailable', 'unsupported_query'])('HTTP failure preserves safe server code %s', async code => {
  fetchMock.mockResolvedValue({ ok: false, status: 503, json: async () => ({ error: code }) });
  await expect(fetchEventCapabilities(signal())).rejects.toMatchObject({ name: 'EventServiceError', kind: 'http', status: 503, code });
});

test('HTTP status survives malformed error bodies; unknown server text is not exposed', async () => {
  fetchMock.mockResolvedValueOnce({ ok: false, status: 502, json: async () => { throw new Error('not JSON'); } })
    .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: 'private server detail' }) });
  await expect(fetchEventCapabilities(signal())).rejects.toMatchObject({ kind: 'http', status: 502, code: undefined });
  await expect(fetchEventCapabilities(signal())).rejects.toMatchObject({ kind: 'http', status: 500, code: undefined });
});

test('stalled HTTP error body retains received status at deadline', async () => {
  jest.useFakeTimers();
  fetchMock.mockResolvedValue({ ok: false, status: 503, json: () => new Promise(() => {}) });
  const check = expect(fetchEventCapabilities(signal())).rejects.toMatchObject({ kind: 'http', status: 503 });
  await jest.advanceTimersByTimeAsync(8000); await check;
});

test('transport, timeout, malformed JSON, and incompatible coverage have distinct error kinds', async () => {
  fetchMock.mockRejectedValueOnce(new TypeError('Network request failed'));
  await expect(fetchEventCapabilities(signal())).rejects.toMatchObject({ kind: 'network' });
  fetchMock.mockResolvedValueOnce({ ok: true, json: async () => { throw new SyntaxError('bad JSON'); } });
  await expect(fetchEventCapabilities(signal())).rejects.toMatchObject({ kind: 'invalid_response' });
  fetchMock.mockResolvedValueOnce(response({ schema_version: 9 }));
  await expect(fetchEventCapabilities(signal())).rejects.toMatchObject({ kind: 'invalid_response' });
  jest.useFakeTimers(); fetchMock.mockImplementation(() => new Promise(() => {}));
  const check = expect(fetchEventCapabilities(signal())).rejects.toMatchObject({ kind: 'timeout' });
  await jest.advanceTimersByTimeAsync(8000); await check;
});
