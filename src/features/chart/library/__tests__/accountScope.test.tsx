import React from 'react';
import { AppState } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthProvider, useAuth } from '@/auth/auth-context';
import { captureSession, clearSession, storeSession } from '@/auth/session';
import { ActiveChartsProvider, useActiveCharts } from '../../active/ActiveChartsContext';
import { ACTIVE_CHARTS_KEY } from '../../active/model';
import { DEFAULT_SETTINGS } from '../../settings/chartSettings';
import { createChartLibraryStore, type ChartLibraryStore } from '../store';
import { testDatabase } from '../test-support/sqlite';
import mockFixture from '../../fixtures/engine/seattle-2026.json';

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));
jest.mock('expo-web-browser', () => ({ openAuthSessionAsync: jest.fn() }));
jest.mock('../../data/calculateChart', () => ({ calculateChart: jest.fn(async () => mockFixture) }));

const originalAppState = AppState.currentState;
const A = { did: 'did:plc:account-a', handle: 'a.example' };
const B = { did: 'did:plc:account-b', handle: 'b.example' };
const draft = { name: 'Anonymous natal', datetime: '1990-06-01T12:00:00.000Z', settings: DEFAULT_SETTINGS };
let database: ReturnType<typeof testDatabase>;
let library: ChartLibraryStore;
let state: ReturnType<typeof useActiveCharts>;
let auth: ReturnType<typeof useAuth>;
let view: ReactTestRenderer | undefined;
let fetchMock: jest.Mock;
function Probe() {
  const charts = useActiveCharts();
  const account = useAuth();
  React.useLayoutEffect(() => { state = charts; auth = account; });
  return null;
}
async function mount() {
  await act(async () => {
    view = create(<AuthProvider><ActiveChartsProvider library={library}><Probe /></ActiveChartsProvider></AuthProvider>);
  });
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(accept => { resolve = accept; });
  return { promise, resolve };
}
beforeEach(async () => {
  AppState.currentState = 'active';
  await clearSession();
  await AsyncStorage.clear();
  database = testDatabase();
  library = await createChartLibraryStore(database.db, () => AsyncStorage.getItem(ACTIVE_CHARTS_KEY));
  fetchMock = jest.fn().mockRejectedValue(new Error('offline'));
  global.fetch = fetchMock;
});
afterEach(async () => {
  if (view) await act(async () => { view!.unmount(); });
  view = undefined;
  await clearSession();
  database.close();
  AppState.currentState = originalAppState;
});

test('login and local edits do not opt into sync; signout hides account sources and restores the anonymous wheel', async () => {
  await mount();
  let anonymousId = '';
  await act(async () => {
    anonymousId = (await state.saveChart(draft)).id;
    state.openSaved(anonymousId);
  });
  const anonymousWheel = state.active;
  await act(async () => { await storeSession('token-a', A); });
  expect(state.scope).toBe(A.did);
  expect(state.saved.map(chart => chart.id)).toContain(anonymousId);
  let accountId = '';
  await act(async () => {
    accountId = (await state.saveChart({ ...draft, name: 'Private A' })).id;
    state.openSaved(accountId);
  });
  expect((await library.syncState(A.did)).enabled).toBe(false);
  expect(fetchMock).not.toHaveBeenCalled();
  await act(async () => { await auth.signOut(); });
  expect(state.scope).toBeNull();
  expect(state.saved.map(chart => chart.id)).toEqual([anonymousId]);
  expect(state.active).toEqual(anonymousWheel);
  expect(state.active.some(chart => chart.sourceId === accountId)).toBe(false);
  expect((await library.load(A.did, DEFAULT_SETTINGS)).saved.map(chart => chart.id)).toContain(accountId);
  expect(fetchMock).not.toHaveBeenCalled();
});

test('explicit inclusion adopts anonymous charts and removes their instances from the signed-out wheel', async () => {
  await mount();
  let sourceId = '';
  await act(async () => {
    sourceId = (await state.saveChart(draft)).id;
    state.openSaved(sourceId);
  });
  await act(async () => { await storeSession('token-a', A); });
  expect(fetchMock).not.toHaveBeenCalled();
  const consent = (await captureSession())!;
  await act(async () => { await state.setSyncEnabled(true, true, consent); });
  expect((await library.syncState(A.did)).enabled).toBe(true);
  expect(fetchMock).toHaveBeenCalled();
  expect((await library.load(null, DEFAULT_SETTINGS)).saved).toEqual([]);
  expect((await library.load(null, DEFAULT_SETTINGS)).active.some(chart => chart.sourceId === sourceId)).toBe(false);
  expect(state.saved.map(chart => chart.id)).toContain(sourceId);
  // Offline transport does not undo the explicit ownership decision or local save.
  expect(state.syncError).toBe('offline');
  await act(async () => { await auth.signOut(); });
  expect(state.saved).toEqual([]);
  expect(state.active.some(chart => chart.sourceId === sourceId)).toBe(false);
});

test.each([['different account', B], ['same DID reauthentication', A]] as const)(
  'a delayed consent callback cannot adopt after %s', async (_name, next) => {
    await library.saveChart(null, draft);
    await storeSession('token-a', A);
    await mount();
    const consent = (await captureSession())!;
    const confirm = state.setSyncEnabled;
    await act(async () => { await storeSession('new-token', next); });
    await act(async () => { await confirm(true, true, consent); });
    expect((await library.syncState(A.did)).enabled).toBe(false);
    expect((await library.load(null, DEFAULT_SETTINGS)).saved).toHaveLength(1);
    expect(fetchMock).not.toHaveBeenCalled();
  },
);

test.each([['different account', B], ['same DID reauthentication', A]] as const)(
  'adoption rolls back if %s arrives during its SQLite transaction', async (_name, next) => {
    await library.saveChart(null, draft);
    await storeSession('token-a', A);
    await mount();
    const consent = (await captureSession())!;
    const entered = deferred<void>();
    const release = deferred<void>();
    const query = database.db.getAllAsync.bind(database.db);
    const spy = jest.spyOn(database.db, 'getAllAsync').mockImplementation(async (sql, ...params) => {
      if (sql.includes('SELECT * FROM library_records WHERE content IS NOT NULL')) {
        entered.resolve();
        await release.promise;
      }
      return query(sql, ...params);
    });
    let enabling!: Promise<void>;
    await act(async () => {
      enabling = state.setSyncEnabled(true, true, consent);
      await entered.promise;
    });
    await act(async () => { await storeSession('new-token', next); });
    await act(async () => { release.resolve(); await enabling; });
    spy.mockRestore();
    expect((await library.syncState(A.did)).enabled).toBe(false);
    expect((await library.load(null, DEFAULT_SETTINGS)).saved).toHaveLength(1);
    expect(await library.pending(A.did)).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  },
);
