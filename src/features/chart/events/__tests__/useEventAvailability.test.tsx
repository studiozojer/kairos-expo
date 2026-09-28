import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AppState, type AppStateStatus } from 'react-native';
import { fetchEventCapabilities } from '../api';
import { useEventAvailability } from '../useEventAvailability';
import type { EventCapabilities } from '../types';
jest.mock('../api', () => ({ fetchEventCapabilities: jest.fn() }));
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
  act(() => { latest.markUnavailable(); });
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
