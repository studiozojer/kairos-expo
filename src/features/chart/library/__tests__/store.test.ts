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

it('rejects account-owned instances from a stale anonymous session write after adoption', async () => {
  const store = await createChartLibraryStore(sql.db);
  const chart = await store.saveChart(null, draft);
  const stale = await store.load(null, DEFAULT_SETTINGS);
  stale.active = [{ id: 'old-instance', kind: 'saved', sourceId: chart.id, name: chart.name, origin: Date.parse(chart.datetime), time: Date.parse(chart.datetime), unit: 2, settings: chart.settings }];
  stale.targetId = 'old-instance';
  await store.saveSession(null, stale);
  await store.enableSync('did:a', true);
  await store.saveSession(null, stale);
  const signedOut = await store.load(null, DEFAULT_SETTINGS);
  expect(signedOut.active).toEqual([]);
  expect(signedOut.targetId).toBeNull();
  expect(signedOut.saved).toEqual([]);
});
it('keeps conflict-copy Unicode valid at the truncation boundary', async () => {
  const store = await createChartLibraryStore(sql.db);
  const chart = await store.saveChart('did:a', { ...draft, name: `${'a'.repeat(183)}🌙 tail` });
  const sent = await store.pending('did:a');
  await store.applyResults('did:a', sent, [{ operationId: sent[0].operationId, outcome: 'conflict', record: { ...remote(sent[0], 2), chart: draft } }]);
  const copy = (await store.load('did:a', DEFAULT_SETTINGS)).saved.find(saved => saved.id !== chart.id)!;
  expect(copy.name).toBe(`${'a'.repeat(183)} (conflict copy)`);
  expect(() => encodeURIComponent(copy.name)).not.toThrow();
});
it('preserves oversized legacy charts offline and requires an edit before adopting them', async () => {
  const oversized = { ...draft, name: 'a'.repeat(201), id: 'legacy-long-name' };
  const session = { ...initialSession(), saved: [oversized] };
  const store = await createChartLibraryStore(sql.db, async () => JSON.stringify(session));
  expect((await store.load(null, DEFAULT_SETTINGS)).saved).toEqual([oversized]);
  await expect(store.enableSync('did:a', true)).rejects.toThrow('Shorten chart names');
  expect((await store.syncState('did:a')).enabled).toBe(false);
  expect(await store.pending('did:a')).toEqual([]);
  expect((await store.load(null, DEFAULT_SETTINGS)).saved).toEqual([oversized]);
  await store.saveChart(null, draft, oversized.id);
  await store.enableSync('did:a', true);
  expect(await store.pending('did:a')).toHaveLength(1);
});
it('preserves a newer remote edit when an already-open editor saves its old baseline', async () => {
  const store = await createChartLibraryStore(sql.db);
  const chart = await store.saveChart('did:a', draft);
  const sent = await store.pending('did:a');
  await store.applyResults('did:a', sent, [{ operationId: sent[0].operationId, outcome: 'applied', record: remote(sent[0], 1) }]);
  await store.applyChanges('did:a', [{ ...remote(sent[0], 2), chart: { ...draft, name: 'Remote edited' } }], 2);
  const result = await store.saveChart('did:a', { ...draft, name: 'My editor draft' }, chart.id, draft);
  expect(result.id).not.toBe(chart.id);
  expect(result.name).toBe('My editor draft (conflict copy)');
  expect((await store.load('did:a', DEFAULT_SETTINGS)).saved.find(saved => saved.id === chart.id)?.name).toBe('Remote edited');
  expect((await store.pending('did:a'))[0]).toMatchObject({ chartId: result.id, baseRevision: 0 });
});
it('rolls back adoption when account authorization changes inside the transaction', async () => {
  const store = await createChartLibraryStore(sql.db);
  const chart = await store.saveChart(null, draft);
  const authorize = jest.fn().mockReturnValueOnce(true).mockReturnValueOnce(false);
  await expect(store.enableSync('did:a', true, authorize)).rejects.toThrow('Account changed');
  expect((await store.load(null, DEFAULT_SETTINGS)).saved).toEqual([chart]);
  expect((await store.syncState('did:a')).enabled).toBe(false);
  expect(await store.pending('did:a')).toEqual([]);
});
it('shadows colliding anonymous IDs in the account view without overwriting anonymous originals', async () => {
  const store = await createChartLibraryStore(sql.db);
  const anonymous = await store.saveChart(null, draft);
  await store.applyChanges('did:a', [{ id: anonymous.id, revision: 1, chart: { ...draft, name: 'Account copy' }, updatedAt: '2026-09-29T00:00:00Z' }], 1);
  expect((await store.load('did:a', DEFAULT_SETTINGS)).saved.map(chart => chart.name)).toEqual(['Account copy']);
  await store.saveChart('did:a', { ...draft, name: 'Account edit' }, anonymous.id);
  expect((await store.load(null, DEFAULT_SETTINGS)).saved).toEqual([anonymous]);
  await expect(store.enableSync('did:a', true)).rejects.toThrow('Enable sync without including local charts');
  await store.deleteChart('did:a', anonymous.id);
  expect((await store.load('did:a', DEFAULT_SETTINGS)).saved).toEqual([]);
  expect((await store.load(null, DEFAULT_SETTINGS)).saved).toEqual([anonymous]);
});
it('saves an open editor draft as a copy after the source is deleted remotely', async () => {
  const store = await createChartLibraryStore(sql.db);
  const original = await store.saveChart('did:a', draft);
  const sent = await store.pending('did:a');
  await store.applyResults('did:a', sent, [{ operationId: sent[0].operationId, outcome: 'applied', record: remote(sent[0]) }]);
  await store.applyChanges('did:a', [{ ...remote(sent[0], 2), chart: null }], 2);
  const copy = await store.saveChart('did:a', draft, original.id, draft);
  expect(copy.id).not.toBe(original.id);
  expect((await store.load('did:a', DEFAULT_SETTINGS)).saved).toEqual([copy]);
  expect(await sql.db.getFirstAsync('SELECT content,revision FROM library_records WHERE owner=? AND id=?', 'did:a', original.id)).toEqual({ content: null, revision: 2 });
});

const metadata = { favorite: true, tags: [{ id: 'family', name: 'Family' }] };
it('preserves metadata on legacy edits and duplicate/conflict copies and accepts explicit clears', async () => {
  const store = await createChartLibraryStore(sql.db);
  const saved = await store.saveChart(null, { ...draft, metadata });
  expect((await store.saveChart(null, { ...draft, name: 'Legacy' }, saved.id)).metadata).toEqual(metadata);
  const duplicate = await store.saveChart(null, saved);
  expect(duplicate.id).not.toBe(saved.id);
  expect(duplicate.metadata).toEqual(metadata);
  const stale = await store.saveChart(null, { ...saved, name: 'Draft' }, saved.id, saved);
  expect(stale.id).not.toBe(saved.id);
  expect(stale.metadata).toEqual(metadata);
  expect((await store.saveChart(null, { ...draft, metadata: { tags: [], favorite: false } }, saved.id)).metadata).toEqual({ tags: [], favorite: false });
});
it('detects a metadata-only editor conflict and favorites the current record without overwriting edits', async () => {
  const store = await createChartLibraryStore(sql.db);
  const saved = await store.saveChart(null, draft);
  await store.saveChart(null, { ...saved, name: 'Latest', metadata }, saved.id);
  await store.setFavorite(null, saved.id, false);
  expect((await store.load(null, DEFAULT_SETTINGS)).saved[0]).toMatchObject({ name: 'Latest', metadata: { ...metadata, favorite: false } });
  const current = (await store.load(null, DEFAULT_SETTINGS)).saved[0];
  await store.setFavorite(null, saved.id, true);
  const conflict = await store.saveChart(null, { ...current, name: 'Unsaved' }, saved.id, current);
  expect(conflict.id).not.toBe(saved.id);
  expect(conflict.metadata?.favorite).toBe(false);
});
it.each([false, true])('takes acknowledged preserved metadata into legacy writes (newer local edit: %s)', async newer => {
  const store = await createChartLibraryStore(sql.db);
  const chart = await store.saveChart('did:a', draft);
  const sent = await store.pending('did:a');
  if (newer) await store.saveChart('did:a', { ...draft, name: 'Newer' }, chart.id);
  await store.applyResults('did:a', sent, [{ operationId: sent[0].operationId, outcome: 'applied', record: { ...remote(sent[0]), chart: { ...draft, metadata } } }]);
  const saved = (await store.load('did:a', DEFAULT_SETTINGS)).saved[0];
  expect(saved.metadata).toEqual(metadata);
  expect(saved.name).toBe(newer ? 'Newer' : draft.name);
  if (newer) expect((await store.pending('did:a'))[0].chart?.metadata).toEqual(metadata);
  else expect(await store.pending('did:a')).toEqual([]);
  expect(sent[0].chart?.metadata).toBeUndefined();
});
it('does not replace an explicit local metadata clear with an older acknowledgement', async () => {
  const store = await createChartLibraryStore(sql.db);
  const chart = await store.saveChart('did:a', draft);
  const sent = await store.pending('did:a');
  await store.saveChart('did:a', { ...draft, metadata: { tags: [], favorite: false } }, chart.id);
  await store.applyResults('did:a', sent, [{ operationId: sent[0].operationId, outcome: 'applied', record: { ...remote(sent[0]), chart: { ...draft, metadata } } }]);
  expect((await store.pending('did:a'))[0].chart?.metadata).toEqual({ tags: [], favorite: false });
});
it('stores sort and opened history per viewer without adding them to chart payloads', async () => {
  const store = await createChartLibraryStore(sql.db);
  const chart = await store.saveChart('did:a', draft);
  await Promise.all([store.setLibrarySort('did:a', 'name-desc'), store.markOpened('did:a', chart.id, 10)]);
  expect(await store.loadPreferences('did:a')).toEqual({ sort: 'name-desc', opened: { [chart.id]: 10 } });
  expect(await store.loadPreferences(null)).toEqual({ sort: 'recent', opened: {} });
  expect(await store.loadPreferences('did:b')).toEqual({ sort: 'recent', opened: {} });
  const reopened = await createChartLibraryStore(sql.db);
  expect(await reopened.loadPreferences('did:a')).toEqual(await store.loadPreferences('did:a'));
  expect((await store.pending('did:a'))[0].chart).toEqual(draft);
});
it('suggests tags only from the destination chart ownership scope', async () => {
  const store = await createChartLibraryStore(sql.db);
  const anonymous = await store.saveChart(null, { ...draft, metadata });
  await store.saveChart('did:a', { ...draft, metadata: { favorite: false, tags: [{ id: 'work', name: 'Work' }] } });
  expect(await store.tagSuggestions('did:a', anonymous.id)).toEqual(metadata.tags);
  expect(await store.tagSuggestions('did:a')).toEqual([{ id: 'work', name: 'Work' }]);
  expect(await store.tagSuggestions('did:b')).toEqual([]);
});
it('validates metadata on save and rolls back malformed incoming pages', async () => {
  const store = await createChartLibraryStore(sql.db);
  const invalid = [null, { favorite: true, tags: [{ id: 'a', name: ' Family ' }, { id: 'b', name: 'family' }] }, { favorite: true, tags: [{ id: 'bad id', name: 'Tag' }] }];
  for (const value of invalid) {
    expect(() => store.saveChart(null, { ...draft, metadata: value as never })).toThrow();
    await expect(store.applyChanges('did:a', [{ id: 'remote', revision: 1, updatedAt: '2026-09-30T00:00:00Z', chart: { ...draft, metadata: value as never } }], 1)).rejects.toThrow();
  }
  expect((await store.syncState('did:a')).cursor).toBe(0);
  expect((await store.load('did:a', DEFAULT_SETTINGS)).saved).toEqual([]);
});
