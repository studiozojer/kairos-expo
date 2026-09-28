import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AppState, type AppStateStatus } from 'react-native';
import { EventServiceError, fetchEventCapabilities } from '../api';
import { useEventAvailability } from '../useEventAvailability';
import type { EventCapabilities } from '../types';
jest.mock('../api', () => ({ ...jest.requireActual('../api'), fetchEventCapabilities: jest.fn() }));
const fetchCapabilities = jest.mocked(fetchEventCapabilities);
const cap = { available: true } as EventCapabilities;
let latest: ReturnType<typeof useEventAvailability>;
let view: ReactTestRenderer;
let change: (status: AppStateStatus) => void;
function Probe({ enabled = true }: { enabled?: boolean }) {
  const value = useEventAvailability(enabled);
  React.useLayoutEffect(() => { latest = value; });
  return null;
}
beforeEach(() => {
  jest.useFakeTimers(); fetchCapabilities.mockReset();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => { change = callback; return { remove: jest.fn() }; });
});
afterEach(() => { if (view) act(() => view.unmount()); jest.restoreAllMocks(); jest.useRealTimers(); });

test('gates on service response, polls without overlap and retries errors', async () => {
  let resolve!: (value: EventCapabilities) => void;
  fetchCapabilities.mockImplementationOnce(() => new Promise(done => { resolve = done; })).mockRejectedValueOnce(new Error('offline')).mockResolvedValue(cap);
  await act(async () => { view = create(<Probe />); });
  expect(latest.status).toBe('checking');
  await act(async () => { latest.retry(); jest.advanceTimersByTime(60_000); });
  expect(fetchCapabilities).toHaveBeenCalledTimes(1);
  await act(async () => { resolve(cap); });
  expect(latest.status).toBe('available');
  await act(async () => { jest.advanceTimersByTime(30_000); });
  expect(latest.status).toBe('unavailable');
  expect(latest.capabilities).toBeNull();
  await act(async () => { latest.retry(); });
  expect(latest.status).toBe('available');
});

test('background immediately gates and aborts; stale readiness cannot restore mode', async () => {
  let resolve!: (value: EventCapabilities) => void;
  fetchCapabilities.mockImplementationOnce(() => new Promise(done => { resolve = done; })).mockResolvedValue(cap);
  await act(async () => { view = create(<Probe />); });
  act(() => { change('background'); });
  expect(fetchCapabilities.mock.calls[0][0].aborted).toBe(true);
  expect(latest.status).toBe('unavailable');
  await act(async () => { resolve(cap); jest.advanceTimersByTime(90_000); });
  expect(latest.status).toBe('unavailable');
  expect(fetchCapabilities).toHaveBeenCalledTimes(1);
  await act(async () => { change('active'); });
  expect(latest.status).toBe('available');
});

test('event failure invalidates readiness; disabled responses and disabled screen stay gated', async () => {
  fetchCapabilities.mockResolvedValueOnce(cap).mockResolvedValue({ available: false } as EventCapabilities);
  await act(async () => { view = create(<Probe />); });
  act(() => { latest.reportFailure(new EventServiceError('network', 'offline')); });
  expect(latest.status).toBe('unavailable');
  await act(async () => { latest.retry(); });
  expect(latest.status).toBe('unavailable');
  await act(async () => { view.update(<Probe enabled={false} />); });
  await act(async () => { change('active'); jest.advanceTimersByTime(90_000); latest.retry(); });
  expect(latest.status).toBe('unavailable');
  expect(fetchCapabilities).toHaveBeenCalledTimes(2);
});

test('disabling or unmounting cancels pending work and ignores late results', async () => {
  let resolve!: (value: EventCapabilities) => void;
  fetchCapabilities.mockImplementation(() => new Promise(done => { resolve = done; }));
  await act(async () => { view = create(<Probe />); });
  await act(async () => { view.update(<Probe enabled={false} />); });
  expect(fetchCapabilities.mock.calls[0][0].aborted).toBe(true);
  await act(async () => { resolve(cap); });
  expect(latest.status).toBe('unavailable');
  await act(async () => { view.update(<Probe />); });
  act(() => { view.unmount(); });
  expect(fetchCapabilities.mock.calls[1][0].aborted).toBe(true);
});

test.each(['busy', 'computation_unavailable'])('query %s preserves confirmed readiness and immediately checks again', async code => {
  let resolve!: (value: EventCapabilities) => void;
  fetchCapabilities.mockResolvedValueOnce(cap).mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  await act(async () => { view = create(<Probe />); });
  act(() => { latest.reportFailure(new EventServiceError('http', 'query failed', 503, code)); });
  expect(latest.status).toBe('available');
  expect(latest.capabilities).toBe(cap);
  expect(fetchCapabilities).toHaveBeenCalledTimes(2);
  await act(async () => { resolve(cap); });
  expect(latest.status).toBe('available');
});

test('invalid response keeps ready during recheck but confirmed unavailable gates immediately', async () => {
  let resolve!: (value: EventCapabilities) => void;
  fetchCapabilities.mockResolvedValueOnce(cap).mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  await act(async () => { view = create(<Probe />); });
  act(() => { latest.reportFailure(new EventServiceError('invalid_response', 'bad response')); });
  expect(latest.status).toBe('available');
  await act(async () => { resolve({ available: false } as EventCapabilities); });
  expect(latest.status).toBe('unavailable');
});

test.each(['network', 'timeout', 'unknown'])('%s failure gates immediately then recovers in two seconds', async kind => {
  fetchCapabilities.mockResolvedValue(cap);
  await act(async () => { view = create(<Probe />); });
  act(() => { latest.reportFailure(kind === 'unknown' ? new Error('failure') : new EventServiceError(kind as 'network' | 'timeout', 'failure')); });
  expect(latest.status).toBe('unavailable');
  await act(async () => { jest.advanceTimersByTime(1999); });
  expect(fetchCapabilities).toHaveBeenCalledTimes(1);
  await act(async () => { jest.advanceTimersByTime(1); });
  expect(fetchCapabilities).toHaveBeenCalledTimes(2);
  expect(latest.status).toBe('available');
});

test('urgent query failure invalidates a pending poll; late old readiness cannot undo network fallback', async () => {
  let old!: (value: EventCapabilities) => void;
  fetchCapabilities.mockResolvedValueOnce(cap).mockImplementationOnce(() => new Promise(done => { old = done; })).mockResolvedValue(cap);
  await act(async () => { view = create(<Probe />); jest.advanceTimersByTime(0); });
  await act(async () => { jest.advanceTimersByTime(30_000); });
  act(() => { latest.reportFailure(new EventServiceError('network', 'offline')); });
  expect(fetchCapabilities.mock.calls[1][0].aborted).toBe(true);
  await act(async () => { old(cap); });
  expect(latest.status).toBe('unavailable');
  await act(async () => { jest.advanceTimersByTime(2000); });
  expect(latest.status).toBe('available');
});

test('readiness failures back off 2,5,10,30 seconds and reset after recovery without overlap', async () => {
  fetchCapabilities.mockRejectedValue(new Error('offline'));
  await act(async () => { view = create(<Probe />); });
  for (const [index, delay] of [2000, 5000, 10000, 30000].entries()) {
    await act(async () => { jest.advanceTimersByTime(delay - 1); });
    expect(fetchCapabilities).toHaveBeenCalledTimes(index + 1);
    await act(async () => { jest.advanceTimersByTime(1); });
    expect(fetchCapabilities).toHaveBeenCalledTimes(index + 2);
  }
  fetchCapabilities.mockResolvedValueOnce(cap);
  await act(async () => { latest.retry(); });
  expect(latest.status).toBe('available');
  await act(async () => { jest.advanceTimersByTime(30_000); });
  const failures = fetchCapabilities.mock.calls.length;
  await act(async () => { jest.advanceTimersByTime(2000); });
  expect(fetchCapabilities).toHaveBeenCalledTimes(failures + 1);
});

test('query error replaces an old poll; stale false readiness cannot defeat newer success', async () => {
  let old!: (value: EventCapabilities) => void;
  fetchCapabilities.mockResolvedValueOnce(cap).mockImplementationOnce(() => new Promise(done => { old = done; })).mockResolvedValue(cap);
  await act(async () => { view = create(<Probe />); });
  await act(async () => { jest.advanceTimersByTime(30_000); });
  await act(async () => { latest.reportFailure(new EventServiceError('http', 'busy', 503, 'busy')); });
  expect(fetchCapabilities.mock.calls[1][0].aborted).toBe(true);
  expect(latest.status).toBe('available');
  await act(async () => { old({ available: false } as EventCapabilities); });
  expect(latest.status).toBe('available');
  expect(fetchCapabilities).toHaveBeenCalledTimes(3);
});

test('cancellation is not reported as service failure and does not start a recheck', async () => {
  fetchCapabilities.mockResolvedValue(cap);
  await act(async () => { view = create(<Probe />); });
  act(() => { latest.reportFailure(Object.assign(new Error('cancelled'), { name: 'AbortError' })); });
  expect(latest.status).toBe('available');
  expect(fetchCapabilities).toHaveBeenCalledTimes(1);
});
