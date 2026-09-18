import React from 'react';
import type { ChartSettings } from '../../settings/chartSettings';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useLoadTimeChart } from '../useLoadTimeChart';
import { calculateChart } from '../calculateChart';
import fixture from '../../fixtures/engine/seattle-2026.json';

jest.mock('../calculateChart', () => ({ calculateChart: jest.fn() }));
const calculate = jest.mocked(calculateChart);
let latest: ReturnType<typeof useLoadTimeChart>;
function Probe({ revision: _revision = 0 }) { latest = useLoadTimeChart(); return null; }
let view: ReactTestRenderer;

beforeEach(() => { calculate.mockReset(); jest.useFakeTimers(); jest.setSystemTime(new Date('2026-09-13T19:00:00Z')); });
afterEach(() => { if (view) act(() => view.unmount()); jest.useRealTimers(); });

test('captures once, preserves time on rerender, and captures anew on remount', async () => {
  calculate.mockResolvedValue(fixture);
  await act(async () => { view = create(<Probe />); });
  expect(latest.status).toBe('ready');
  jest.setSystemTime(new Date('2026-09-14T19:00:00Z'));
  await act(async () => { view.update(<Probe revision={1} />); });
  expect(calculate).toHaveBeenCalledTimes(1);
  expect(latest.datetime).toBe('2026-09-13T19:00:00.000Z');
  act(() => view.unmount());
  await act(async () => { view = create(<Probe />); });
  expect(calculate).toHaveBeenLastCalledWith('2026-09-14T19:00:00.000Z');
});

test('retry uses the same instant and recovers from a native failure', async () => {
  const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
  calculate.mockRejectedValueOnce(new Error('native failed')).mockResolvedValue(fixture);
  await act(async () => { view = create(<Probe />); });
  expect(latest.status).toBe('error');
  jest.setSystemTime(new Date('2026-09-14T19:00:00Z'));
  await act(async () => { latest.retry(); });
  expect(latest.status).toBe('ready');
  expect(calculate.mock.calls.map(args => args[0])).toEqual([
    '2026-09-13T19:00:00.000Z', '2026-09-13T19:00:00.000Z',
  ]);
  warning.mockRestore();
});

test('a result from an unmounted instance cannot replace the next instance', async () => {
  let finishOld!: (value: typeof fixture) => void;
  calculate.mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; }))
    .mockResolvedValue(fixture);
  await act(async () => { view = create(<Probe />); });
  expect(latest.status).toBe('loading');
  act(() => view.unmount());
  await act(async () => { view = create(<Probe />); });
  await act(async () => { finishOld({ ...fixture, celestial: { nodes: [], edges: [] } }); });
  expect(latest.chart).toEqual(fixture);
});

test('changing defaults keeps the instant and ignores an older calculation finishing last', async () => {
  const original = { location: { name: 'Seattle', latitude: 47.6062, longitude: -122.3321, elevation: 0, timezone: 'America/Los_Angeles' }, houseSystem: 'Placidus' as const };
  const changed = { ...original, houseSystem: 'Whole Sign' as const };
  function SettingsProbe({ settings = original, enabled = true }: { settings?: ChartSettings; enabled?: boolean }) { latest = useLoadTimeChart(settings, enabled); return null; }
  let finishOld!: (value: typeof fixture) => void;
  calculate.mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; })).mockResolvedValue(fixture);
  await act(async () => { view = create(<SettingsProbe enabled={false} />); });
  expect(calculate).not.toHaveBeenCalled();
  await act(async () => { view.update(<SettingsProbe />); });
  jest.setSystemTime(new Date('2026-09-14T19:00:00Z'));
  await act(async () => { view.update(<SettingsProbe settings={changed} />); });
  expect(calculate).toHaveBeenLastCalledWith('2026-09-13T19:00:00.000Z', changed);
  await act(async () => { finishOld({ ...fixture, celestial: { nodes: [], edges: [] } }); });
  expect(latest.chart).toEqual(fixture);
});
