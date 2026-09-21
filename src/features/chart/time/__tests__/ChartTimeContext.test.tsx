import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActiveChartsProvider, useActiveCharts } from '../../active/ActiveChartsContext';
import { ChartTimeProvider, useChartTime } from '../ChartTimeContext';
import { calculateChart } from '../../data/calculateChart';
import { DEFAULT_SETTINGS } from '../../settings/chartSettings';
import fixture from '../../fixtures/engine/seattle-2026.json';

jest.mock('../../data/calculateChart', () => ({ calculateChart: jest.fn() }));
const calculate = jest.mocked(calculateChart);
let session: ReturnType<typeof useActiveCharts>;
let clock: ReturnType<typeof useChartTime>;
let view: ReactTestRenderer;
function Probe() {
  const value = useChartTime();
  const active = useActiveCharts();
  React.useLayoutEffect(() => { clock = value; session = active; });
  return null;
}
beforeEach(async () => {
  await AsyncStorage.clear();
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-09-16T12:00:00Z'));
  calculate.mockReset().mockResolvedValue(fixture);
});
afterEach(() => { act(() => view.unmount()); jest.useRealTimers(); });

test('rapid steps accumulate; unit changes preserve time; reset uses fresh Now and retains settings', async () => {
  await act(async () => { view = create(<ActiveChartsProvider><ChartTimeProvider enabled><Probe /></ChartTimeProvider></ActiveChartsProvider>); });
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
  await act(async () => { view = create(<ActiveChartsProvider><ChartTimeProvider enabled><Probe /></ChartTimeProvider></ActiveChartsProvider>); });
  await act(async () => { clock.step(1); clock.selectUnit(3); });
  await act(async () => { view.update(<ActiveChartsProvider><ChartTimeProvider enabled={false}><Probe /></ChartTimeProvider></ActiveChartsProvider>); });
  expect(clock.canStepForward).toBe(false);
  expect(clock.canStepBackward).toBe(false);
  await act(async () => { view.update(<ActiveChartsProvider><ChartTimeProvider enabled><Probe /></ChartTimeProvider></ActiveChartsProvider>); });
  expect(clock.datetime).toBe('2026-09-17T12:00:00.000Z');
  expect(clock.unit).toBe(3);
  expect(clock.canStepForward).toBe(true);
});


test('glass controls step the explicit target through reorder and never mutate saved originals', async () => {
  await act(async () => { view = create(<ActiveChartsProvider><ChartTimeProvider enabled><Probe /></ChartTimeProvider></ActiveChartsProvider>); });
  const transitId = session.targetId!;
  const transitTime = clock.time;
  let natalId = '';
  let savedId = '';
  await act(async () => {
    const saved = session.saveChart({ name: 'Natal', datetime: '1990-05-12T10:00:00.000Z', settings: DEFAULT_SETTINGS });
    savedId = saved.id;
    session.openSaved(saved.id);
  });
  natalId = session.targetId!;
  await act(async () => { session.move(natalId, -1); clock.step(1); });
  expect(clock.targetId).toBe(natalId);
  expect(clock.datetime).toBe('1990-05-13T10:00:00.000Z');
  expect(session.active.find(chart => chart.id === transitId)!.time).toBe(transitTime);
  expect(session.saved.find(chart => chart.id === savedId)!.datetime).toBe('1990-05-12T10:00:00.000Z');
  await act(async () => { clock.reset(); });
  expect(clock.datetime).toBe('1990-05-12T10:00:00.000Z');
  await act(async () => { session.selectTarget(transitId); clock.step(1); });
  expect(clock.time).toBe(transitTime + 86400000);
  expect(session.active.find(chart => chart.id === natalId)!.time).toBe(Date.parse('1990-05-12T10:00:00.000Z'));
});
