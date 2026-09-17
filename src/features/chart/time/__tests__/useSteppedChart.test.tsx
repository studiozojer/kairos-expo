import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useSteppedChart } from '../useSteppedChart';
import { calculateChart } from '../../data/calculateChart';
import { DEFAULT_SETTINGS } from '../../settings/chartSettings';
import fixture from '../../fixtures/engine/seattle-2026.json';

jest.mock('../../data/calculateChart', () => ({ calculateChart: jest.fn() }));
const calculate = jest.mocked(calculateChart);
let latest: ReturnType<typeof useSteppedChart>;
let view: ReactTestRenderer;
function Probe({ time, settings = DEFAULT_SETTINGS, enabled = true }: {
  time: string; settings?: typeof DEFAULT_SETTINGS; enabled?: boolean;
}) {
  const value = useSteppedChart(time, settings, enabled);
  React.useLayoutEffect(() => { latest = value; });
  return null;
}
const first = '2026-09-16T12:00:00Z';
const second = '2026-09-17T12:00:00Z';
const last = '2026-09-20T12:00:00Z';
beforeEach(() => { calculate.mockReset(); jest.spyOn(console, 'warn').mockImplementation(() => {}); });
afterEach(() => { if (view) act(() => view.unmount()); jest.restoreAllMocks(); });

test('rapid steps queue only the latest target and never overlap native work', async () => {
  let resolveFirst!: (value: typeof fixture) => void;
  calculate.mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve; })).mockResolvedValue(fixture);
  await act(async () => { view = create(<Probe time={first} />); });
  await act(async () => { view.update(<Probe time={second} />); });
  await act(async () => { view.update(<Probe time={last} />); });
  expect(calculate).toHaveBeenCalledTimes(1);
  await act(async () => { resolveFirst(fixture); });
  expect(calculate.mock.calls.map(call => call[0])).toEqual([first, last]);
  expect(latest.result?.datetime).toBe(last);
  expect(latest.status).toBe('ready');
});

test('keeps the old chart, date and location together through pending work and failure; retry recovers', async () => {
  let fail!: (reason: Error) => void;
  calculate.mockResolvedValueOnce(fixture).mockImplementationOnce(() => new Promise((_, reject) => { fail = reject; }))
    .mockResolvedValue(fixture);
  const changed = { ...DEFAULT_SETTINGS, houseSystem: 'Whole Sign' as const };
  await act(async () => { view = create(<Probe time={first} />); });
  await act(async () => { view.update(<Probe time={second} settings={changed} />); });
  expect(latest.status).toBe('loading');
  expect(latest.result).toMatchObject({ datetime: first, settings: DEFAULT_SETTINGS, chart: fixture });
  await act(async () => { fail(new Error('native failure')); });
  expect(latest.status).toBe('error');
  expect(latest.result?.datetime).toBe(first);
  await act(async () => { latest.retry(); });
  expect(calculate).toHaveBeenLastCalledWith(second, changed);
  expect(latest.result?.datetime).toBe(second);
});

test('leaving the chart discards queued requests; resuming uses the latest time and settings', async () => {
  let resolveFirst!: (value: typeof fixture) => void;
  calculate.mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve; })).mockResolvedValue(fixture);
  await act(async () => { view = create(<Probe time={first} />); });
  await act(async () => { view.update(<Probe time={second} />); });
  await act(async () => { view.update(<Probe time={second} enabled={false} />); });
  await act(async () => { resolveFirst(fixture); });
  expect(calculate).toHaveBeenCalledTimes(1);
  expect(latest.result).toBeUndefined();
  await act(async () => { view.update(<Probe time={last} />); });
  expect(latest.result?.datetime).toBe(last);
});

test('an obsolete failure does not overwrite a newer successful request', async () => {
  let rejectFirst!: (value: Error) => void;
  calculate.mockImplementationOnce(() => new Promise((_, reject) => { rejectFirst = reject; })).mockResolvedValue(fixture);
  await act(async () => { view = create(<Probe time={first} />); });
  await act(async () => { view.update(<Probe time={last} />); });
  await act(async () => { rejectFirst(new Error('old failure')); });
  expect(latest.status).toBe('ready');
  expect(latest.result?.datetime).toBe(last);
});
