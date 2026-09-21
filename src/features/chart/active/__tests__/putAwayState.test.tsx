import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActiveChartsProvider, useActiveCharts } from '../ActiveChartsContext';
import { ACTIVE_CHARTS_KEY, parseSession, removeInstance, type ActiveSession } from '../model';
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
  ['first', 'second'],
  ['second', 'third'],
  ['third', 'second'],
])('removing selected %s chooses its next neighbor, or previous at the outer edge', (id, target) => {
  const before = { ...session(), targetId: id };
  const next = removeInstance(before, id);
  expect(next.targetId).toBe(target);
  expect(next.active.map(chart => chart.id)).toEqual(before.active.filter(chart => chart.id !== id).map(chart => chart.id));
  expect(before.active).toHaveLength(3);
  expect(next.saved).toBe(before.saved);
  for (const chart of next.active) expect(chart).toBe(before.active.find(item => item.id === chart.id));
});

describe('putting away open instances', () => {
  let state: ReturnType<typeof useActiveCharts>;
  let view: ReactTestRenderer;
  function Probe() {
    const value = useActiveCharts();
    React.useLayoutEffect(() => { state = value; });
    return null;
  }
  const mount = async () => { await act(async () => { view = create(<ActiveChartsProvider><Probe /></ActiveChartsProvider>); }); };
  beforeEach(async () => {
    await AsyncStorage.clear();
    await AsyncStorage.setItem(ACTIVE_CHARTS_KEY, JSON.stringify(session()));
    jest.clearAllMocks();
    jest.mocked(calculateChart).mockReset().mockResolvedValue(fixture);
  });
  afterEach(() => { if (view) act(() => view.unmount()); });

  test('unselected removal preserves the target and independently explored duplicate, including after relaunch', async () => {
    await mount();
    const survivors = state.active.slice(1);
    const saved = state.saved;
    const selectedCalculation = state.calculations.second;
    jest.mocked(calculateChart).mockClear();
    await act(async () => { state.remove('first'); });
    expect(state.targetId).toBe('second');
    expect(state.active).toEqual(survivors);
    expect(state.active[0]).toBe(survivors[0]);
    expect(state.active[1]).toBe(survivors[1]);
    expect(state.calculations.first).toBeUndefined();
    expect(state.calculations.second).toEqual(selectedCalculation);
    expect(state.saved).toBe(saved);
    expect(calculateChart).not.toHaveBeenCalled();
    const stored = parseSession((await AsyncStorage.getItem(ACTIVE_CHARTS_KEY))!);
    expect(stored).toEqual({ version: 1, saved, active: survivors, targetId: 'second' });
    act(() => view.unmount());
    await mount();
    expect(state.active).toEqual(survivors);
    expect(state.targetId).toBe('second');
    expect(state.saved).toEqual(saved);
  });

  test('removing every instance persists an empty wheel, then reopening uses the unchanged saved original', async () => {
    await mount();
    const saved = state.saved[0];
    await act(async () => {
      state.remove('second');
      state.remove('third');
      state.remove('first');
    });
    expect(state.active).toEqual([]);
    expect(state.targetId).toBeNull();
    expect(state.calculations).toEqual({});
    expect(state.saved).toEqual([saved]);
    expect(parseSession((await AsyncStorage.getItem(ACTIVE_CHARTS_KEY))!)).toEqual({
      version: 1, saved: [saved], active: [], targetId: null,
    });
    act(() => view.unmount());
    await mount();
    expect(state.active).toEqual([]);
    expect(state.targetId).toBeNull();
    await act(async () => { expect(state.openSaved(saved.id)).toBe(true); });
    expect(state.active).toHaveLength(1);
    const reopened = state.active[0];
    expect(['first', 'second', 'third']).not.toContain(reopened.id);
    expect(reopened).toMatchObject({ sourceId: saved.id, origin: originalTime, time: originalTime, settings: saved.settings });
    expect(state.targetId).toBe(reopened.id);
    expect(state.saved).toEqual([saved]);
  });

  test.each(['resolve', 'reject'] as const)('a removed instance’s pending calculation cannot return after %s, even when its source is reopened', async outcome => {
    await mount();
    let resolve!: (value: typeof fixture) => void;
    let reject!: (reason: Error) => void;
    jest.mocked(calculateChart).mockImplementationOnce(() => new Promise((accept, fail) => { resolve = accept; reject = fail; }));
    await act(async () => { state.step(1); });
    expect(state.calculations.second.status).toBe('loading');
    await act(async () => { state.remove('second'); });
    expect(state.targetId).toBe('third');
    await act(async () => { expect(state.openSaved('source')).toBe(true); });
    const reopenedId = state.targetId!;
    const before = { active: state.active, saved: state.saved, calculations: state.calculations };
    const storedBefore = await AsyncStorage.getItem(ACTIVE_CHARTS_KEY);
    const writes = jest.mocked(AsyncStorage.setItem).mock.calls.length;
    await act(async () => {
      if (outcome === 'resolve') resolve(fixture);
      else reject(new Error('Removed request failed'));
    });
    expect(state.calculations.second).toBeUndefined();
    expect({ active: state.active, saved: state.saved, calculations: state.calculations }).toEqual(before);
    expect(state.calculations[reopenedId].status).toBe('ready');
    expect(state.calculations[reopenedId].result?.datetime).toBe(new Date(originalTime).toISOString());
    expect(state.targetId).toBe(reopenedId);
    expect(await AsyncStorage.getItem(ACTIVE_CHARTS_KEY)).toBe(storedBefore);
    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(writes);
  });
});
