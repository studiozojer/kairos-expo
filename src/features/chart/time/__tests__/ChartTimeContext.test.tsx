import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ChartTimeProvider, useChartTime } from '../ChartTimeContext';
import { calculateChart } from '../../data/calculateChart';
import { DEFAULT_SETTINGS } from '../../settings/chartSettings';
import fixture from '../../fixtures/engine/seattle-2026.json';

jest.mock('../../data/calculateChart', () => ({ calculateChart: jest.fn() }));
const calculate = jest.mocked(calculateChart);
let clock: ReturnType<typeof useChartTime>;
let view: ReactTestRenderer;
function Probe() {
  const value = useChartTime();
  React.useLayoutEffect(() => { clock = value; });
  return null;
}
beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-09-16T12:00:00Z'));
  calculate.mockReset().mockResolvedValue(fixture);
});
afterEach(() => { act(() => view.unmount()); jest.useRealTimers(); });

test('rapid steps accumulate; unit changes preserve time; reset uses fresh Now and retains settings', async () => {
  await act(async () => { view = create(<ChartTimeProvider enabled><Probe /></ChartTimeProvider>); });
  await act(async () => { clock.step(1); clock.step(1); clock.step(1); });
  expect(clock.datetime).toBe('2026-09-19T12:00:00.000Z');
  await act(async () => { clock.selectUnit(0); });
  expect(clock.datetime).toBe('2026-09-19T12:00:00.000Z');
  await act(async () => { clock.step(-1); });
  expect(clock.datetime).toBe('2026-09-19T11:59:00.000Z');
  const changed = { ...DEFAULT_SETTINGS, houseSystem: 'Whole Sign' as const };
  await act(async () => { clock.update(changed); });
  expect(clock.datetime).toBe('2026-09-19T11:59:00.000Z');
  jest.setSystemTime(new Date('2026-09-16T12:15:00Z'));
  await act(async () => { clock.reset(); });
  expect(clock.datetime).toBe('2026-09-16T12:15:00.000Z');
  expect(clock.time).toBe(clock.origin);
  expect(calculate).toHaveBeenLastCalledWith(clock.datetime, changed);
});

test('leaving the chart disables controls without losing its selected time or unit', async () => {
  await act(async () => { view = create(<ChartTimeProvider enabled><Probe /></ChartTimeProvider>); });
  await act(async () => { clock.step(1); clock.selectUnit(3); });
  await act(async () => { view.update(<ChartTimeProvider enabled={false}><Probe /></ChartTimeProvider>); });
  expect(clock.canStepForward).toBe(false);
  expect(clock.canStepBackward).toBe(false);
  await act(async () => { view.update(<ChartTimeProvider enabled><Probe /></ChartTimeProvider>); });
  expect(clock.datetime).toBe('2026-09-17T12:00:00.000Z');
  expect(clock.unit).toBe(3);
  expect(clock.canStepForward).toBe(true);
});
