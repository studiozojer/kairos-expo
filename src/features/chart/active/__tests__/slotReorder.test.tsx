import React from 'react';
import { createChartLibraryStore, type ChartLibraryStore } from '../../library/store';
import { testDatabase } from '../../library/test-support/sqlite';

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));
let database: ReturnType<typeof testDatabase>;
let library: ChartLibraryStore;
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActiveChartsProvider, useActiveCharts } from '../ActiveChartsContext';
import { ACTIVE_CHARTS_KEY, reorderInstance, type ActiveSession } from '../model';
import { DEFAULT_SETTINGS } from '../../settings/chartSettings';
import { calculateChart } from '../../data/calculateChart';
import fixture from '../../fixtures/engine/seattle-2026.json';

jest.mock('../../data/calculateChart', () => ({ calculateChart: jest.fn() }));
const originalTime = Date.parse('1990-06-01T12:00:00.000Z');
function session(): ActiveSession {
  return {
    version: 1,
    saved: [{ id: 'source', name: 'Natal', datetime: new Date(originalTime).toISOString(), settings: DEFAULT_SETTINGS }],
    active: ['first', 'second', 'third'].map((id, index) => ({
      id, sourceId: 'source', kind: 'saved', name: 'Natal', origin: originalTime,
      time: originalTime + index * 86400000, unit: index,
      settings: { ...DEFAULT_SETTINGS, houseSystem: index === 1 ? 'Whole Sign' : 'Placidus' },
    })),
    targetId: 'second',
  };
}

test.each([
  ['first', 'third', ['second', 'third', 'first']],
  ['third', 'first', ['third', 'first', 'second']],
])('moves %s into %s slot by insertion, preserving snapshots and selected target', (source, target, expected) => {
  const before = session();
  const next = reorderInstance(before, source, target);
  expect(next.active.map(chart => chart.id)).toEqual(expected);
  expect(before.active.map(chart => chart.id)).toEqual(['first', 'second', 'third']);
  expect(next.targetId).toBe('second');
  expect(next.saved).toBe(before.saved);
  for (const chart of before.active) expect(next.active.find(item => item.id === chart.id)).toBe(chart);
  expect(new Set(next.active.map(chart => chart.sourceId))).toEqual(new Set(['source']));
});

test.each([['first', 'first'], ['missing', 'third'], ['first', 'missing']])('ignores drop with source %s and target %s', (source, target) => {
  const before = session();
  expect(reorderInstance(before, source, target)).toBe(before);
});

describe('provider slot moves', () => {
  let state: ReturnType<typeof useActiveCharts>;
  let view: ReactTestRenderer;
  function Probe() { const value = useActiveCharts(); React.useLayoutEffect(() => { state = value; }); return null; }
  const mount = async () => { await act(async () => { view = create(<ActiveChartsProvider library={library}><Probe /></ActiveChartsProvider>); }); };
  beforeEach(async () => {
    await AsyncStorage.clear();
    await AsyncStorage.setItem(ACTIVE_CHARTS_KEY, JSON.stringify(session()));
    database = testDatabase();
    library = await createChartLibraryStore(database.db, () => AsyncStorage.getItem(ACTIVE_CHARTS_KEY));
    jest.clearAllMocks();
    jest.mocked(calculateChart).mockReset().mockResolvedValue(fixture);
  });
  afterEach(() => { if (view) act(() => view.unmount()); database.close(); });

  test('same-event moves use current identity positions and persist complete session for relaunch', async () => {
    await mount();
    const before = state.active;
    const persist = jest.spyOn(library, 'saveSession');
    await act(async () => {
      state.moveTo('first', 'third'); // second, third, first
      state.moveTo('third', 'second'); // third, second, first
    });
    expect(state.active.map(chart => chart.id)).toEqual(['third', 'second', 'first']);
    expect(state.targetId).toBe('second');
    for (const chart of before) expect(state.active.find(item => item.id === chart.id)).toBe(chart);
    const writes = persist.mock.calls;
    expect(writes).toHaveLength(2);
    expect(writes.map(([scope, snapshot]) => {
      expect(scope).toBeNull();
      return snapshot.active.map(chart => chart.id);
    })).toEqual([['second', 'third', 'first'], ['third', 'second', 'first']]);
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    const snapshot = { active: state.active, saved: state.saved, targetId: state.targetId };
    act(() => view.unmount());
    await mount();
    expect({ active: state.active, saved: state.saved, targetId: state.targetId }).toEqual(snapshot);
    expect(persist).toHaveBeenCalledTimes(3); // The restored session is checkpointed once.
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  test('same-slot and missing-identity drops do not persist or recalculate', async () => {
    await mount();
    const before = state.active;
    const persist = jest.spyOn(library, 'saveSession');
    jest.mocked(calculateChart).mockClear();
    await act(async () => {
      state.moveTo('first', 'first');
      state.moveTo('first', 'removed');
      state.moveTo('removed', 'third');
    });
    expect(state.active).toBe(before);
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    expect(calculateChart).not.toHaveBeenCalled();
    expect(persist).not.toHaveBeenCalled();
  });
});
