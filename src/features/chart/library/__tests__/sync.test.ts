jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn() }));
jest.mock('@/auth/session', () => ({ authorizedFetch: jest.fn(), captureSession: jest.fn(), isCurrentSession: jest.fn(), renewSession: jest.fn() }));
import { authorizedFetch, captureSession, isCurrentSession, renewSession, type SessionSnapshot } from '@/auth/session';
import { createChartLibraryStore, type ChartLibraryStore } from '../store';
import { syncCharts, SyncInterrupted } from '../sync';
import { testDatabase } from '../test-support/sqlite';
import { DEFAULT_SETTINGS } from '../../settings/chartSettings';
import type { SyncOperation, SyncRecord, SyncResult } from '../types';
const did = 'did:plc:alice';
const draft = { name: 'Natal', datetime: '2000-01-01T12:00:00.000Z', settings: DEFAULT_SETTINGS };
let databases: ReturnType<typeof testDatabase>[];
let current: SessionSnapshot;
let records: Map<string, SyncRecord>;
let receipts: Map<string, SyncResult>;
let revision: number;
let loseNextReply: boolean;
let beforeResponse: (() => Promise<void>) | undefined;
let calls: string[];
async function client() {
  const sql = testDatabase(); databases.push(sql);
  const store = await createChartLibraryStore(sql.db);
  await store.enableSync(did, false);
  return store;
}
const run = (store: ChartLibraryStore) => syncCharts(store, did, new AbortController().signal);
beforeEach(() => {
  databases = []; records = new Map(); receipts = new Map(); revision = 0; loseNextReply = false; beforeResponse = undefined; calls = [];
  current = { token: 'session-a', account: { did, handle: 'alice.test' }, generation: 1 } as unknown as SessionSnapshot;
  jest.mocked(captureSession).mockImplementation(async () => current);
  jest.mocked(isCurrentSession).mockImplementation(value => value === current);
  jest.mocked(renewSession).mockImplementation(async () => current);
  jest.mocked(authorizedFetch).mockImplementation(async (path, init) => {
    const route = String(path); calls.push(route);
    let body: unknown;
    if (route.endsWith('/push')) {
      const operations: SyncOperation[] = JSON.parse(init!.body as string).operations;
      body = { results: operations.map(operation => {
        const receipt = receipts.get(operation.operationId);
        if (receipt) return { ...receipt, outcome: receipt.outcome === 'applied' ? 'replayed' : receipt.outcome };
        const old = records.get(operation.chartId);
        let result: SyncResult;
        if ((old?.revision ?? 0) !== operation.baseRevision || (old?.chart === null && operation.chart !== null)) {
          result = { operationId: operation.operationId, outcome: 'conflict', record: old ?? null };
        } else {
          const record = { id: operation.chartId, revision: ++revision, chart: operation.chart, updatedAt: '2026-09-29T00:00:00Z' };
          records.set(record.id, record);
          result = { operationId: operation.operationId, outcome: 'applied', record };
        }
        receipts.set(operation.operationId, result);
        return result;
      }) };
      if (loseNextReply) { loseNextReply = false; throw new Error('Connection lost after server commit'); }
    } else {
      const cursor = Number(new URL(route, 'https://test.invalid').searchParams.get('cursor'));
      const changes = [...records.values()].filter(record => record.revision > cursor).sort((a, b) => a.revision - b.revision);
      const page = changes.slice(0, 100);
      body = { records: page, cursor: page.at(-1)?.revision ?? cursor, hasMore: changes.length > page.length };
    }
    if (beforeResponse) { const hook = beforeResponse; beforeResponse = undefined; await hook(); }
    return { ok: true, json: async () => body } as Response;
  });
});
afterEach(() => databases.forEach(db => db.close()));
it('syncs two offline clients, preserves concurrent edits as a copy, and propagates deletion after relaunch', async () => {
  const a = await client(), b = await client();
  const saved = await a.saveChart(did, draft);
  await run(a); await run(b);
  expect((await b.load(did, DEFAULT_SETTINGS)).saved).toEqual([saved]);
  await a.saveChart(did, { ...draft, name: 'Device A edit' }, saved.id);
  await b.saveChart(did, { ...draft, name: 'Device B edit' }, saved.id);
  await run(a); await run(b); await run(a);
  const both = (await a.load(did, DEFAULT_SETTINGS)).saved;
  expect(both.map(chart => chart.name).sort()).toEqual(['Device A edit', 'Device B edit (conflict copy)']);
  expect((await b.load(did, DEFAULT_SETTINGS)).saved).toEqual(both);
  await b.deleteChart(did, saved.id); await run(b);
  const restartedA = await createChartLibraryStore(databases[0].db);
  await run(restartedA);
  expect((await restartedA.load(did, DEFAULT_SETTINGS)).saved.map(chart => chart.name)).toEqual(['Device B edit (conflict copy)']);
});
it('retries the exact committed operation after a lost reply and retains a newer local edit', async () => {
  const a = await client();
  const saved = await a.saveChart(did, draft);
  const original = await a.pending(did);
  loseNextReply = true;
  await expect(run(a)).rejects.toThrow('Connection lost');
  await a.saveChart(did, { ...draft, name: 'Edit after lost reply' }, saved.id);
  const restarted = await createChartLibraryStore(databases[0].db);
  expect(await restarted.pending(did)).toEqual(original);
  await run(restarted);
  expect(records.size).toBe(1);
  expect(records.get(saved.id)?.chart?.name).toBe('Edit after lost reply');
  expect(await restarted.pending(did)).toEqual([]);
  expect((await restarted.syncState(did)).conflicts).toBe(0);
});
it('does not apply a response from the previous session after switching accounts', async () => {
  const a = await client();
  const saved = await a.saveChart(did, draft);
  beforeResponse = async () => { current = { ...current, account: { ...current.account, did: 'did:plc:bob' } }; };
  await expect(run(a)).rejects.toBeInstanceOf(SyncInterrupted);
  expect(await a.pending(did)).toHaveLength(1);
  expect((await a.load('did:plc:bob', DEFAULT_SETTINGS)).saved).toEqual([]);
  expect(records.get(saved.id)?.chart?.name).toBe('Natal'); // already dispatched under Alice, never Bob
  expect((await a.syncState(did)).cursor).toBe(0);
});
it('keeps local edits made during the request and sends their rebased operation before pulling', async () => {
  const a = await client();
  const saved = await a.saveChart(did, draft);
  beforeResponse = async () => { await a.saveChart(did, { ...draft, name: 'Edited in flight' }, saved.id); };
  await run(a);
  expect(records.get(saved.id)?.chart?.name).toBe('Edited in flight');
  expect(calls.slice(0, 2)).toEqual(['/api/chart-sync/v2/push', '/api/chart-sync/v2/push']);
  expect((await a.syncState(did)).conflicts).toBe(0);
});
it('rejects out-of-order changes without advancing cursor or replacing local records', async () => {
  const a = await client();
  jest.mocked(authorizedFetch).mockResolvedValueOnce({ ok: true, json: async () => ({ records: [
    { id: 'second', revision: 2, chart: draft, updatedAt: '2026-09-29T00:00:00Z' },
    { id: 'first', revision: 1, chart: draft, updatedAt: '2026-09-29T00:00:00Z' },
  ], cursor: 2, hasMore: false }) } as Response);
  await expect(run(a)).rejects.toThrow('Out-of-order');
  expect((await a.syncState(did)).cursor).toBe(0);
  expect((await a.load(did, DEFAULT_SETTINGS)).saved).toEqual([]);
});
