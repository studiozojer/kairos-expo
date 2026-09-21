import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActiveChartsProvider, useActiveCharts } from '../ActiveChartsContext';
import { ChartTimeProvider, useChartTime } from '../../time/ChartTimeContext';
import { buildMultiConfiguration } from '../../config/buildConfiguration';
import { bundledPreset } from '../../display/presets';
import { DEFAULT_SETTINGS } from '../../settings/chartSettings';
import { calculateChart } from '../../data/calculateChart';
import fixture from '../../fixtures/engine/seattle-2026.json';

jest.mock('../../data/calculateChart', () => ({ calculateChart: jest.fn() }));
let session: ReturnType<typeof useActiveCharts>;
let clock: ReturnType<typeof useChartTime>;
let view: ReactTestRenderer;
function Probe() {
  const state = useActiveCharts();
  const time = useChartTime();
  React.useLayoutEffect(() => { session = state; clock = time; });
  return null;
}
async function mount() {
  await act(async () => { view = create(<ActiveChartsProvider><ChartTimeProvider enabled><Probe /></ChartTimeProvider></ActiveChartsProvider>); });
}
function configuration() {
  return buildMultiConfiguration(session.active.map(item => ({ instanceId: item.id, name: item.name,
    chart: session.calculations[item.id].result!.chart })), bundledPreset('classic')!.preset);
}
beforeEach(async () => {
  await AsyncStorage.clear();
  jest.mocked(calculateChart).mockImplementation(async (datetime, settings = DEFAULT_SETTINGS) => ({
    ...fixture, chart_metadata: { ...fixture.chart_metadata, datetime, coordinates: settings.location },
  }));
});
afterEach(() => { if (view) act(() => view.unmount()); });

test('create, explore three charts, reorder, remove, and relaunch preserve saved originals and render identities', async () => {
  await mount();
  const transitId = session.targetId!;
  const transitTime = clock.time;
  await act(async () => {
    const natal = session.saveChart({ name: 'Natal', datetime: '1990-06-01T12:00:00.000Z', settings: DEFAULT_SETTINGS });
    session.openSaved(natal.id);
  });
  const natalId = session.targetId!;
  await act(async () => { session.move(natalId, -1); clock.step(1); });
  expect(clock.time).toBe(Date.parse('1990-06-02T12:00:00.000Z'));
  expect(session.active.find(c => c.id === transitId)!.time).toBe(transitTime);
  const dual = configuration();
  const dualPlanets = dual.rings.flatMap(r => r.type.kind === 'planets' ? r.type.placements : []);
  const suns = dualPlanets.filter(p => p.bodyId === 'sun');
  expect(suns).toHaveLength(2);
  expect(suns[0].id).not.toBe(suns[1].id);
  // Identical fixtures intentionally produce a same-body cross-chart conjunction.
  expect(dual.aspectEdges.some(edge => new Set([edge.from, edge.to]).size === 2 &&
    [edge.from, edge.to].every(id => suns.some(sun => sun.id === id)))).toBe(true);
  await act(async () => { session.openSaved(session.saved[0].id); });
  const thirdId = session.targetId!;
  expect(configuration().rings.filter(r => r.type.kind === 'planets')).toHaveLength(3);
  await act(async () => { session.move(thirdId, -1); });
  expect(session.targetId).toBe(thirdId);
  await act(async () => { session.remove(thirdId); session.selectTarget(natalId); });
  const before = session.active;
  const savedBefore = session.saved;
  act(() => view.unmount());
  await mount();
  expect(session.active).toEqual(before);
  expect(session.saved).toEqual(savedBefore);
  expect(session.saved[0].datetime).toBe('1990-06-01T12:00:00.000Z');
  expect(clock.targetId).toBe(natalId);
  expect(configuration().rings.flatMap(r => r.type.kind === 'planets' ? r.type.placements : []).map(p => p.id))
    .toEqual(dualPlanets.map(p => p.id));
});
