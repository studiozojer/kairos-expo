jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () => ({ getItem: jest.fn() }));
import { createChartLibraryStore } from '../store';
import { testDatabase } from '../test-support/sqlite';
import { DEFAULT_SETTINGS } from '../../settings/chartSettings';
import { initialSession, type ChartDraft } from '../../active/model';
import type { SyncOperation, SyncRecord } from '../types';
const draft: ChartDraft = { name: 'Natal', datetime: '2000-01-01T12:00:00.000Z', settings: DEFAULT_SETTINGS };
const remote = (operation: SyncOperation, revision = 1): SyncRecord => ({ id: operation.chartId, chart: operation.chart, revision, updatedAt: '2026-09-29T00:00:00Z' });
let sql: ReturnType<typeof testDatabase>;
beforeEach(() => { sql = testDatabase(); });
afterEach(() => sql.close());
it('imports once, preserves exact IDs/session/raw and leaves corrupt legacy recoverable', async () => {
  const session = { ...initialSession(), saved: [{ ...draft, id: 'existing-id' }] };
  const raw = JSON.stringify(session);
  const read = jest.fn(async () => raw);
  const store = await createChartLibraryStore(sql.db, read);
  expect(await store.load(null, DEFAULT_SETTINGS)).toEqual(session);
  expect(await sql.db.getFirstAsync('SELECT value FROM library_meta WHERE key=?', 'legacyRaw')).toEqual({ value: raw });
  await createChartLibraryStore(sql.db, read);
  expect(read).toHaveBeenCalledTimes(1);
});
it('does not complete a corrupt migration', async () => {
  await expect(createChartLibraryStore(sql.db, async () => '{bad')).rejects.toThrow();
  expect(await sql.db.getFirstAsync('SELECT * FROM library_meta')).toBeNull();
  await expect(createChartLibraryStore(sql.db)).resolves.toBeDefined();
});
it('allows duplicates, hides account records, keeps anonymous edits anonymous, and never saves library from a session', async () => {
  const store = await createChartLibraryStore(sql.db);
  const anon = await store.saveChart(null, draft);
  const account = await store.saveChart('did:a', draft);
  await store.saveChart('did:a', { ...draft, name: 'Edited anon' }, anon.id);
  expect((await store.load(null, DEFAULT_SETTINGS)).saved.map(c => c.name)).toEqual(['Edited anon']);
  expect((await store.load('did:a', DEFAULT_SETTINGS)).saved).toHaveLength(2);
  expect((await store.load('did:b', DEFAULT_SETTINGS)).saved).toHaveLength(1);
  await store.saveSession('did:a', { ...initialSession(), saved: [] });
  expect((await store.load('did:a', DEFAULT_SETTINGS)).saved.some(c => c.id === account.id)).toBe(true);
  expect((await store.syncState('did:a')).enabled).toBe(false);
});
it('atomically adopts anonymous sources only on explicit inclusion and pauses sync without losing work', async () => {
  const store = await createChartLibraryStore(sql.db);
  await store.saveChart(null, draft);
  await store.enableSync('did:a', false);
  expect(await store.pending('did:a')).toHaveLength(0);
  await store.enableSync('did:a', true);
  expect((await store.load(null, DEFAULT_SETTINGS)).saved).toHaveLength(0);
  expect(await store.pending('did:a')).toHaveLength(1);
  await store.disableSync('did:a');
  expect((await store.syncState('did:a')).enabled).toBe(false);
  expect(await store.pending('did:a')).toHaveLength(1);
});
it('keeps retries immutable and rebases edits made during an in-flight request', async () => {
  const store = await createChartLibraryStore(sql.db);
  const chart = await store.saveChart('did:a', draft);
  const sent = await store.pending('did:a');
  await store.saveChart('did:a', { ...draft, name: 'Latest' }, chart.id);
  expect(await store.pending('did:a')).toEqual(sent);
  await store.applyResults('did:a', sent, [{ operationId: sent[0].operationId, outcome: 'replayed', record: remote(sent[0], 4) }]);
  const next = await store.pending('did:a');
  expect(next[0]).toMatchObject({ baseRevision: 4, chart: { name: 'Latest' } });
  expect(next[0].operationId).not.toBe(sent[0].operationId);
  await store.applyResults('did:a', sent, [{ operationId: sent[0].operationId, outcome: 'replayed', record: remote(sent[0], 4) }]);
  expect(await store.pending('did:a')).toEqual(next);
  await store.applyResults('did:a', next, [{ operationId: next[0].operationId, outcome: 'applied', record: remote(next[0], 5) }]);
  expect(await store.pending('did:a')).toHaveLength(0);
});
it('preserves the latest local conflict copy and adopts remote original transactionally', async () => {
  const store = await createChartLibraryStore(sql.db);
  const chart = await store.saveChart('did:a', draft);
  const sent = await store.pending('did:a');
  await store.saveChart('did:a', { ...draft, name: 'Latest' }, chart.id);
  await store.applyResults('did:a', sent, [{ operationId: sent[0].operationId, outcome: 'conflict', record: { ...remote(sent[0], 5), chart: { ...draft, name: 'Remote' } } }]);
  const saved = (await store.load('did:a', DEFAULT_SETTINGS)).saved;
  expect(saved.find(c => c.id === chart.id)?.name).toBe('Remote');
  expect(saved.find(c => c.id !== chart.id)?.name).toBe('Latest (conflict copy)');
  expect(await store.pending('did:a')).toHaveLength(1);
  expect((await store.syncState('did:a')).conflicts).toBe(1);
});
it('carries a deletion made in flight forward and never silently resurrects tombstones', async () => {
  const store = await createChartLibraryStore(sql.db);
  const chart = await store.saveChart('did:a', draft);
  const sent = await store.pending('did:a');
  await store.deleteChart('did:a', chart.id);
  await store.applyResults('did:a', sent, [{ operationId: sent[0].operationId, outcome: 'applied', record: remote(sent[0]) }]);
  const deletion = await store.pending('did:a');
  expect(deletion[0]).toMatchObject({ chart: null, baseRevision: 1 });
  await store.applyResults('did:a', deletion, [{ operationId: deletion[0].operationId, outcome: 'conflict', record: { ...remote(sent[0], 2), chart: { ...draft, name: 'Remote edit' } } }]);
  expect((await store.load('did:a', DEFAULT_SETTINGS)).saved[0].name).toBe('Remote edit');
  expect((await store.syncState('did:a')).conflicts).toBe(1);
});
it('commits changes with cursor, preserves dirty copies, and rolls back malformed pages', async () => {
  const store = await createChartLibraryStore(sql.db);
  const chart = await store.saveChart('did:a', draft);
  const sent = await store.pending('did:a');
  await store.applyChanges('did:a', [{ ...remote(sent[0], 7), chart: null }], 7);
  const saved = (await store.load('did:a', DEFAULT_SETTINGS)).saved;
  expect(saved).toHaveLength(1);
  expect(saved[0].id).not.toBe(chart.id);
  expect((await store.syncState('did:a')).cursor).toBe(7);
  await expect(store.applyChanges('did:a', [remote(sent[0], 9)], 8)).rejects.toThrow();
  expect((await store.syncState('did:a')).cursor).toBe(7);
});
it('rolls back a saved record if its outbox write fails', async () => {
  const store = await createChartLibraryStore(sql.db);
  await sql.db.execAsync("CREATE TRIGGER fail_outbox BEFORE INSERT ON library_outbox BEGIN SELECT RAISE(ABORT, 'disk full'); END");
  await expect(store.saveChart('did:a', draft)).rejects.toThrow('disk full');
  expect((await store.load('did:a', DEFAULT_SETTINGS)).saved).toHaveLength(0);
});
it('detaches deleted open sources while preserving explored time and target across reload', async () => {
  const store = await createChartLibraryStore(sql.db);
  const chart = await store.saveChart(null, draft);
  const session = await store.load(null, DEFAULT_SETTINGS);
  session.active = [{ id: 'instance', kind: 'saved', sourceId: chart.id, name: chart.name, origin: Date.parse(chart.datetime), time: Date.parse(chart.datetime) + 60000, unit: 2, settings: chart.settings }];
  session.targetId = 'instance';
  await store.saveSession(null, session);
  await store.deleteChart(null, chart.id);
  const reloaded = await (await createChartLibraryStore(sql.db)).load(null, DEFAULT_SETTINGS);
  expect(reloaded.active[0]).toEqual({ ...session.active[0], kind: 'snapshot', sourceId: undefined });
  expect(reloaded.targetId).toBe('instance');
});
it('restores exact pending operations after restart and rolls back partial acknowledgements', async () => {
  const store = await createChartLibraryStore(sql.db);
  await store.saveChart('did:a', draft);
  await store.saveChart('did:a', draft);
  const sent = await store.pending('did:a');
  const reopened = await createChartLibraryStore(sql.db);
  expect(await reopened.pending('did:a')).toEqual(sent);
  await expect(reopened.applyResults('did:a', sent, [
    { operationId: sent[0].operationId, outcome: 'applied', record: remote(sent[0]) },
    { operationId: sent[1].operationId, outcome: 'applied', record: { ...remote(sent[1], 2), id: 'wrong-id' } },
  ])).rejects.toThrow();
  expect(await reopened.pending('did:a')).toEqual(sent);
  expect((await reopened.syncState('did:a')).pending).toBe(2);
});
it('removes adopted instances from the anonymous session without changing the account wheel', async () => {
  const store = await createChartLibraryStore(sql.db);
  const chart = await store.saveChart(null, draft);
  const anonymous = await store.load(null, DEFAULT_SETTINGS);
  const now = anonymous.active[0];
  const adopted = { id: 'adopted-instance', kind: 'saved' as const, sourceId: chart.id, name: chart.name, origin: Date.parse(chart.datetime), time: Date.parse(chart.datetime), unit: 2, settings: chart.settings };
  anonymous.active.push(adopted);
  anonymous.targetId = adopted.id;
  await store.saveSession(null, anonymous);
  await store.saveSession('did:b', anonymous);
  await store.saveSession('did:a', { ...anonymous, active: [adopted], targetId: adopted.id });
  await store.enableSync('did:a', true);
  const signedOut = await store.load(null, DEFAULT_SETTINGS);
  expect(signedOut.saved).toEqual([]);
  expect(signedOut.active).toEqual([now]);
  expect(signedOut.targetId).toBe(now.id);
  expect((await store.load('did:b', DEFAULT_SETTINGS)).active).toEqual([now]);
  const account = await store.load('did:a', DEFAULT_SETTINGS);
  expect(account.active).toEqual([adopted]);
  expect(account.saved[0].id).toBe(chart.id);
});
it('rolls back session removal if adoption ownership transfer fails', async () => {
  const store = await createChartLibraryStore(sql.db);
  const chart = await store.saveChart(null, draft);
  const anonymous = await store.load(null, DEFAULT_SETTINGS);
  anonymous.active = [{ id: 'adopted-instance', kind: 'saved', sourceId: chart.id, name: chart.name, origin: Date.parse(chart.datetime), time: Date.parse(chart.datetime), unit: 2, settings: chart.settings }];
  anonymous.targetId = 'adopted-instance';
  await store.saveSession(null, anonymous);
  await sql.db.execAsync("CREATE TRIGGER fail_adoption BEFORE UPDATE OF owner ON library_records BEGIN SELECT RAISE(ABORT, 'disk full'); END");
  await expect(store.enableSync('did:a', true)).rejects.toThrow('disk full');
  expect(await store.load(null, DEFAULT_SETTINGS)).toEqual(anonymous);
});
