import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActiveChartsProvider, useActiveCharts } from '../ActiveChartsContext';
import { ACTIVE_CHARTS_KEY, parseSession } from '../model';
import { DEFAULT_SETTINGS, SETTINGS_KEY } from '../../settings/chartSettings';
import { calculateChart } from '../../data/calculateChart';
import fixture from '../../fixtures/engine/seattle-2026.json';

jest.mock('../../data/calculateChart', () => ({ calculateChart: jest.fn() }));
const calculate = jest.mocked(calculateChart);
let state: ReturnType<typeof useActiveCharts>;
let view: ReactTestRenderer;
const draft = { name: 'Natal', datetime: '1990-06-01T12:00:00.000Z', settings: DEFAULT_SETTINGS };
function Probe() { const value = useActiveCharts(); React.useLayoutEffect(() => { state = value; }); return null; }
const mount = async () => { await act(async () => { view = create(<ActiveChartsProvider><Probe /></ActiveChartsProvider>); }); };
beforeEach(async () => {
  await AsyncStorage.clear(); jest.clearAllMocks();
  calculate.mockReset().mockResolvedValue(fixture);
});
afterEach(() => { if (view) act(() => view.unmount()); });

test('saved snapshots stay unchanged through independent stepping, reordering, settings edits, and source edits', async () => {
  await mount();
  const now = state.active[0];
  await act(async () => { const saved = state.saveChart(draft); state.openSaved(saved.id); });
  const natal = state.active[1];
  await act(async () => { state.step(1); state.step(1); state.move(natal.id, -1); });
  expect(state.targetId).toBe(natal.id);
  expect(state.active[0].time).toBe(natal.time + 2 * 86400000);
  expect(state.active[1]).toEqual(now);
  expect(state.saved[0].datetime).toBe(draft.datetime);
  await act(async () => { state.saveChart({ ...draft, name: 'Edited' }, state.saved[0].id); state.updateInstanceSettings(natal.id, { ...DEFAULT_SETTINGS, houseSystem: 'Whole Sign' }); });
  expect(state.active[0].name).toBe('Natal');
  expect(state.saved[0].settings.houseSystem).toBe('Placidus');
  await act(async () => { state.reset(); });
  expect(state.active[0].time).toBe(natal.origin);
  expect(parseSession((await AsyncStorage.getItem(ACTIVE_CHARTS_KEY))!).active).toEqual(state.active);
  const snapshot = { active: state.active, saved: state.saved, targetId: state.targetId };
  act(() => view.unmount()); await mount();
  expect({ active: state.active, saved: state.saved, targetId: state.targetId }).toEqual(snapshot);
});

test('fourth chart requires explicit replacement and removal chooses deterministic neighbor without deleting source', async () => {
  await mount();
  await act(async () => { const saved = state.saveChart(draft); state.openSaved(saved.id); state.addNow(); });
  const before = state.active;
  await act(async () => { expect(state.addNow()).toBe(false); expect(state.addNow('missing')).toBe(false); });
  expect(state.active).toEqual(before);
  await act(async () => { expect(state.addNow(before[1].id)).toBe(true); });
  const replacement = state.active[1];
  expect(state.targetId).toBe(replacement.id);
  await act(async () => { state.remove(replacement.id); });
  expect(state.targetId).toBe(before[2].id);
  expect(state.saved).toHaveLength(1);
  await act(async () => { state.active.forEach(chart => state.remove(chart.id)); });
  expect(state.targetId).toBeNull(); expect(state.active).toEqual([]);
  act(() => view.unmount()); await mount(); expect(state.active).toEqual([]);
});

test('malformed or unreadable storage is not overwritten and retry can recover', async () => {
  await AsyncStorage.setItem(ACTIVE_CHARTS_KEY, '{broken');
  jest.mocked(AsyncStorage.setItem).mockClear();
  await mount();
  expect(state.loadError).toBe(true); expect(state.loaded).toBe(false);
  await act(async () => { expect(state.addNow()).toBe(false); state.retryPersistence(); });
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  await AsyncStorage.removeItem(ACTIVE_CHARTS_KEY);
  await act(async () => { state.retryLoad(); });
  expect(state.loaded).toBe(true); expect(state.loadError).toBe(false);
});

test('writes are serialized, failures visible, retry persists the latest session', async () => {
  await mount();
  let release!: () => void;
  jest.mocked(AsyncStorage.setItem).mockImplementationOnce(() => new Promise<void>(resolve => { release = resolve; }));
  await act(async () => { state.step(1); });
  const calls = jest.mocked(AsyncStorage.setItem).mock.calls.length;
  await act(async () => { state.step(1); });
  expect(AsyncStorage.setItem).toHaveBeenCalledTimes(calls);
  expect(state.saving).toBe(true);
  await act(async () => { release(); });
  expect(state.saving).toBe(false);
  jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('disk full'));
  await act(async () => { state.step(1); });
  expect(state.saveError).toBe(true);
  await act(async () => { state.retryPersistence(); });
  expect(state.saveError).toBe(false);
  expect(parseSession((await AsyncStorage.getItem(ACTIVE_CHARTS_KEY))!).active[0].time).toBe(state.active[0].time);
});

test('independent calculation workers discard stale results after stepping and replacement', async () => {
  await mount();
  const nowId = state.active[0].id;
  let resolveOld!: (value: typeof fixture) => void;
  calculate.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
  await act(async () => { state.step(1); });
  await act(async () => { state.step(1); const saved = state.saveChart(draft); state.openSaved(saved.id); });
  const natalId = state.active[1].id;
  expect(state.calculations[natalId].status).toBe('ready');
  await act(async () => { resolveOld(fixture); });
  expect(state.calculations[nowId].result?.datetime).toBe(new Date(state.active[0].time).toISOString());
  expect(state.calculations[natalId].result?.datetime).toBe(draft.datetime);
  let resolveRemoved!: (value: typeof fixture) => void;
  calculate.mockImplementationOnce(() => new Promise(resolve => { resolveRemoved = resolve; }));
  await act(async () => { state.step(1); });
  await act(async () => { state.addNow(natalId); });
  await act(async () => { resolveRemoved(fixture); });
  expect(state.calculations[natalId]).toBeUndefined();
});

test('pending hydration blocks mutations and read failures preserve stored data', async () => {
  let resolveRead!: (value: string | null) => void;
  jest.mocked(AsyncStorage.getItem).mockImplementationOnce(() => new Promise(resolve => { resolveRead = resolve; }));
  await mount();
  expect(state.loaded).toBe(false);
  await act(async () => { expect(state.addNow()).toBe(false); expect(() => state.saveChart(draft)).toThrow('finish loading'); state.step(1); });
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  await act(async () => { resolveRead(null); });
  expect(state.loaded).toBe(true);
  act(() => view.unmount());
  jest.mocked(AsyncStorage.setItem).mockClear();
  jest.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('storage unavailable'));
  await mount();
  expect(state.loadError).toBe(true);
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  await act(async () => { state.retryLoad(); });
  expect(state.loaded).toBe(true);
});


test('new Now charts retain defaults after session restoration; unavailable preferences do not block a valid session', async () => {
  const preferences = { ...DEFAULT_SETTINGS, houseSystem: 'Whole Sign' as const };
  await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(preferences));
  await mount();
  act(() => view.unmount()); await mount();
  await act(async () => { state.addNow(); });
  expect(state.active[1].settings).toEqual(preferences);
  const stored = await AsyncStorage.getItem(ACTIVE_CHARTS_KEY);
  act(() => view.unmount());
  jest.mocked(AsyncStorage.getItem).mockResolvedValueOnce(stored).mockRejectedValueOnce(new Error('preferences unavailable'));
  await mount();
  expect(state.loaded).toBe(true); expect(state.loadError).toBe(false);
  expect(state.active).toHaveLength(2);
});
