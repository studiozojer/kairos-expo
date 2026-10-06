import { normalizeMetadata, sameMetadata, type ChartTag } from './metadata';
import { LIBRARY_SORTS, parseLibraryPreferences, type LibraryPreferences, type LibrarySort } from './preferences';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { openDatabaseAsync } from 'expo-sqlite';
import { ACTIVE_CHARTS_KEY, initialSession, newChartId, parseSession, removeInstance, snapshotSettings, validateDraft, type ActiveSession, type ChartDraft, type SavedChart } from '../active/model';
import { calculationSettings, type ChartSettings } from '../settings/chartSettings';
import type { LibrarySyncState, SyncOperation, SyncRecord, SyncResult } from './types';

type Binding = string | number | null;
/** Small SQL boundary also exercised against real SQLite in repository tests. */
export interface LibraryDatabase {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: Binding[]): Promise<unknown>;
  getAllAsync<T>(sql: string, ...params: Binding[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, ...params: Binding[]): Promise<T | null>;
}
interface Row { owner: string; id: string; content: string | null; revision: number; dirty: number }
interface Account { enabled: number; cursor: number; last_synced: string | null; conflicts: number }
const ownerKey = (scope: string | null) => scope ?? '';
function validateRecord(record: SyncRecord) {
  if (!record || typeof record.id !== 'string' || typeof record.updatedAt !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(record.id) || !Number.isSafeInteger(record.revision) || record.revision < 1 || !Number.isFinite(Date.parse(record.updatedAt))) throw new Error('Invalid server chart record');
  if (record.removedFromAccount !== undefined && (typeof record.removedFromAccount !== 'boolean' || (record.removedFromAccount && record.chart !== null))) throw new Error('Invalid account removal');
  if (record.chart !== null) validateDraft(record.chart);
}

function conflictName(name: string) {
  let prefix = '';
  for (const character of name) {
    if (prefix.length + character.length > 184) break;
    prefix += character;
  }
  return `${prefix} (conflict copy)`;
}
function sameChart(a: ChartDraft | null, b: ChartDraft) {
  if (!a || a.name !== b.name || a.datetime !== b.datetime || a.settings.houseSystem !== b.settings.houseSystem || !sameMetadata(a.metadata, b.metadata)) return false;
  if (JSON.stringify(calculationSettings(a.settings)) !== JSON.stringify(calculationSettings(b.settings))) return false;
  const left = a.settings.location, right = b.settings.location;
  return left.name === right.name && left.latitude === right.latitude && left.longitude === right.longitude && left.elevation === right.elevation && left.timezone === right.timezone;
}
const schema = `
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS library_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS library_records (owner TEXT NOT NULL, id TEXT NOT NULL, content TEXT, revision INTEGER NOT NULL DEFAULT 0, dirty INTEGER NOT NULL DEFAULT 1, PRIMARY KEY(owner,id));
CREATE TABLE IF NOT EXISTS library_sessions (owner TEXT PRIMARY KEY, session TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS library_accounts (owner TEXT PRIMARY KEY, enabled INTEGER NOT NULL DEFAULT 0, cursor INTEGER NOT NULL DEFAULT 0, last_synced TEXT, conflicts INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS library_account_removals (owner TEXT NOT NULL, id TEXT NOT NULL, PRIMARY KEY(owner,id));
CREATE TABLE IF NOT EXISTS library_outbox (owner TEXT NOT NULL, chart_id TEXT NOT NULL, operation TEXT NOT NULL, PRIMARY KEY(owner,chart_id));
`;

export class ChartLibraryStore {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private db: LibraryDatabase, private readLegacy: () => Promise<string | null>) {}
  private serial<T>(work: () => Promise<T>): Promise<T> {
    const next = this.queue.then(work); this.queue = next.catch(() => {}); return next;
  }
  private async transaction<T>(work: () => Promise<T>): Promise<T> {
    await this.db.execAsync('BEGIN IMMEDIATE');
    try { const value = await work(); await this.db.execAsync('COMMIT'); return value; }
    catch (error) { await this.db.execAsync('ROLLBACK'); throw error; }
  }
  async initialize() {
    await this.db.execAsync(schema);
    await this.transaction(async () => {
      if (await this.db.getFirstAsync('SELECT value FROM library_meta WHERE key = ?', 'legacyImported')) return;
      const raw = await this.readLegacy();
      // Parse before marking migration complete; retain original AsyncStorage and a recovery copy.
      if (raw !== null) {
        const session = parseSession(raw);
        for (const { id, ...chart } of session.saved) await this.db.runAsync('INSERT INTO library_records(owner,id,content) VALUES (?,?,?)', '', id, JSON.stringify(chart));
        await this.writeSession('', session);
        await this.db.runAsync('INSERT INTO library_meta(key,value) VALUES (?,?)', 'legacyRaw', raw);
      }
      await this.db.runAsync('INSERT INTO library_meta(key,value) VALUES (?,?)', 'legacyImported', '1');
    });
    return this;
  }
  private async writeSession(owner: string, session: ActiveSession) {
    const { saved: _saved, ...local } = session;
    await this.db.runAsync('INSERT INTO library_sessions(owner,session) VALUES (?,?) ON CONFLICT(owner) DO UPDATE SET session=excluded.session', owner, JSON.stringify(local));
  }
  load(scope: string | null, defaults: ChartSettings): Promise<ActiveSession> {
    return this.serial(async () => {
      const owner = ownerKey(scope);
      const rows = await this.db.getAllAsync<Row>('SELECT visible.* FROM library_records visible WHERE (owner = ? OR owner = ?) AND content IS NOT NULL AND (owner = ? OR NOT EXISTS (SELECT 1 FROM library_records account WHERE account.owner = ? AND account.id = visible.id)) ORDER BY rowid', '', owner, owner, owner);
      const saved = rows.map(row => ({ ...JSON.parse(row.content!), id: row.id } as SavedChart));
      const stored = await this.db.getFirstAsync<{ session: string }>('SELECT session FROM library_sessions WHERE owner = ?', owner);
      const session: ActiveSession = stored ? { ...JSON.parse(stored.session), saved } : { ...initialSession(defaults), saved };
      session.active = session.active.map(chart => chart.sourceId && !saved.some(source => source.id === chart.sourceId) ? { ...chart, kind: 'snapshot', sourceId: undefined } : chart);
      return parseSession(JSON.stringify(session));
    });
  }
  saveSession(scope: string | null, session: ActiveSession): Promise<void> {
    const snapshot = JSON.parse(JSON.stringify(session)) as ActiveSession;
    return this.serial(() => this.transaction(async () => {
      const owner = ownerKey(scope);
      const unavailable = await this.db.getAllAsync<{ id: string }>(
        'SELECT DISTINCT other.id FROM library_records other WHERE other.owner<>? AND other.owner<>? AND NOT EXISTS (SELECT 1 FROM library_records visible WHERE visible.id=other.id AND (visible.owner=? OR visible.owner=?))',
        owner, '', owner, '',
      );
      const hidden = new Set(unavailable.map(row => row.id));
      let safe = snapshot;
      for (const chart of snapshot.active) {
        if (chart.sourceId && hidden.has(chart.sourceId)) safe = removeInstance(safe, chart.id);
      }
      await this.writeSession(owner, safe);
    }));
  }
  private async account(owner: string) {
    await this.db.runAsync('INSERT OR IGNORE INTO library_accounts(owner) VALUES (?)', owner);
    return (await this.db.getFirstAsync<Account>('SELECT * FROM library_accounts WHERE owner = ?', owner))!;
  }
  private async enqueue(row: Row) {
    if (!row.owner || !row.dirty) return;
    // Removed account uploads remain device copies. Local edits/deletions must
    // not silently recreate the account copy after a later sync opt-in.
    if (await this.db.getFirstAsync('SELECT id FROM library_account_removals WHERE owner=? AND id=?', row.owner, row.id)) return;
    // Keeping operations immutable makes a response lost after server commit safe to retry.
    const operation: SyncOperation = { operationId: newChartId(), chartId: row.id, baseRevision: row.revision, chart: row.content === null ? null : JSON.parse(row.content) };
    await this.db.runAsync('INSERT OR IGNORE INTO library_outbox(owner,chart_id,operation) VALUES (?,?,?)', row.owner, row.id, JSON.stringify(operation));
  }
  saveChart(scope: string | null, draft: ChartDraft, id?: string, expected?: ChartDraft): Promise<SavedChart> {
    validateDraft(draft);
    if (draft.name.trim().length > 200 || draft.settings.location.name.length > 300 || draft.settings.location.timezone.length > 100) return Promise.reject(new Error('Chart or location name is too long'));
    const chart: SavedChart = { id: id ?? newChartId(), name: draft.name.trim(), datetime: new Date(draft.datetime).toISOString(), settings: snapshotSettings(draft.settings), ...(draft.metadata === undefined ? {} : { metadata: normalizeMetadata(draft.metadata) }) };
    return this.serial(() => this.transaction(async () => {
      const owner = ownerKey(scope);
      const existing = id ? await this.db.getFirstAsync<Row>('SELECT * FROM library_records WHERE id = ? AND (owner = ? OR owner = ?) ORDER BY (owner = ?) DESC LIMIT 1', id, owner, '', owner) : null;
      if (id && !expected && (!existing || existing.content === null)) throw new Error('Saved chart is no longer available');
      const stale = !!id && !!expected && !sameChart(!existing || existing.content === null ? null : JSON.parse(existing.content), expected);
      if (stale) {
        chart.id = newChartId();
        chart.name = conflictName(chart.name);
        const conflictOwner = existing?.owner ?? owner;
        if (conflictOwner) {
          await this.account(conflictOwner);
          await this.db.runAsync('UPDATE library_accounts SET conflicts=conflicts+1 WHERE owner=?', conflictOwner);
        }
      }
      if (chart.metadata === undefined && existing?.content) {
        const metadata = normalizeMetadata(JSON.parse(existing.content).metadata);
        if (metadata !== undefined) chart.metadata = metadata;
      }
      const { id: chartId, ...content } = chart;
      const row: Row = { owner: existing?.owner ?? owner, id: chartId, content: JSON.stringify(content), revision: stale ? 0 : existing?.revision ?? 0, dirty: 1 };
      await this.db.runAsync('INSERT INTO library_records(owner,id,content,revision,dirty) VALUES (?,?,?,?,1) ON CONFLICT(owner,id) DO UPDATE SET content=excluded.content,dirty=1', row.owner, row.id, row.content, row.revision);
      await this.enqueue(row);
      return chart;
    }));
  }
  setFavorite(scope: string | null, id: string, favorite: boolean): Promise<void> {
    return this.serial(() => this.transaction(async () => {
      const owner = ownerKey(scope);
      const row = await this.db.getFirstAsync<Row>('SELECT * FROM library_records WHERE id=? AND (owner=? OR owner=?) ORDER BY (owner=?) DESC LIMIT 1', id, owner, '', owner);
      if (!row?.content) throw new Error('Saved chart is no longer available');
      const chart = JSON.parse(row.content) as ChartDraft;
      chart.metadata = { tags: normalizeMetadata(chart.metadata)?.tags ?? [], favorite };
      const content = JSON.stringify(chart);
      await this.db.runAsync('UPDATE library_records SET content=?,dirty=1 WHERE owner=? AND id=?', content, row.owner, id);
      await this.enqueue({ ...row, content, dirty: 1 });
    }));
  }
  tagSuggestions(scope: string | null, id?: string): Promise<ChartTag[]> {
    return this.serial(async () => {
      const viewer = ownerKey(scope);
      const existing = id ? await this.db.getFirstAsync<Row>('SELECT * FROM library_records WHERE id=? AND (owner=? OR owner=?) ORDER BY (owner=?) DESC LIMIT 1', id, viewer, '', viewer) : null;
      const rows = await this.db.getAllAsync<Row>('SELECT * FROM library_records WHERE owner=? AND content IS NOT NULL ORDER BY id', existing?.owner ?? viewer);
      const names = new Set<string>();
      return rows.flatMap(row => normalizeMetadata(JSON.parse(row.content!).metadata)?.tags ?? []).filter(tag => {
        const name = tag.name.toLowerCase();
        if (names.has(name)) return false;
        names.add(name); return true;
      });
    });
  }
  private async preferences(scope: string | null): Promise<LibraryPreferences> {
    const row = await this.db.getFirstAsync<{ value: string }>('SELECT value FROM library_meta WHERE key=?', `libraryPreferences:${ownerKey(scope)}`);
    return parseLibraryPreferences(row?.value);
  }
  loadPreferences(scope: string | null) { return this.serial(() => this.preferences(scope)); }
  private async writePreferences(scope: string | null, value: LibraryPreferences) {
    await this.db.runAsync('INSERT INTO library_meta(key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', `libraryPreferences:${ownerKey(scope)}`, JSON.stringify(value));
    return value;
  }
  setLibrarySort(scope: string | null, sort: LibrarySort): Promise<LibraryPreferences> {
    return this.serial(() => this.transaction(async () => {
      if (!LIBRARY_SORTS.includes(sort)) throw new Error('Invalid library sort');
      return this.writePreferences(scope, { ...await this.preferences(scope), sort });
    }));
  }
  markOpened(scope: string | null, id: string, time: number): Promise<LibraryPreferences> {
    return this.serial(() => this.transaction(async () => {
      if (!Number.isFinite(time) || time < 0) throw new Error('Invalid opened time');
      const previous = await this.preferences(scope);
      return this.writePreferences(scope, { ...previous, opened: { ...previous.opened, [id]: time } });
    }));
  }
  deleteChart(scope: string | null, id: string): Promise<void> {
    return this.serial(() => this.transaction(async () => {
      const row = await this.db.getFirstAsync<Row>('SELECT * FROM library_records WHERE id = ? AND (owner = ? OR owner = ?) ORDER BY (owner = ?) DESC LIMIT 1', id, ownerKey(scope), '', ownerKey(scope));
      if (!row || row.content === null) return;
      await this.db.runAsync('UPDATE library_records SET content=NULL,dirty=1 WHERE owner=? AND id=?', row.owner, id);
      await this.enqueue({ ...row, content: null, dirty: 1 });
    }));
  }
  enableSync(did: string, includeAnonymous: boolean, authorize: () => boolean = () => true): Promise<void> {
    return this.serial(() => this.transaction(async () => {
      if (!authorize()) throw new Error('Account changed. Open sync settings again.');
      // Old Expo storage had no length limits. Keep it readable offline, but
      // never freeze an operation the server must reject into the retry outbox.
      const candidates = await this.db.getAllAsync<Row>('SELECT * FROM library_records WHERE content IS NOT NULL AND (owner=? OR owner=?)', did, includeAnonymous ? '' : did);
      for (const row of candidates) {
        const chart = JSON.parse(row.content!) as ChartDraft;
        if (chart.name.length > 200) throw new Error('Shorten chart names to 200 characters before enabling sync. Your charts remain saved locally.');
        if (chart.settings.location.name.length > 300) throw new Error('Shorten location names to 300 characters before enabling sync. Your charts remain saved locally.');
        if (chart.settings.location.timezone.length > 100) throw new Error('Choose a supported timezone before enabling sync. Your charts remain saved locally.');
      }
      await this.account(did);
      if (includeAnonymous) {
        const collision = await this.db.getFirstAsync('SELECT anonymous.id FROM library_records anonymous JOIN library_records account ON account.id=anonymous.id WHERE anonymous.owner=? AND account.owner=? LIMIT 1', '', did);
        if (collision) throw new Error('Some local chart IDs already exist in this account. Enable sync without including local charts; both copies remain saved.');
        // Ownership transfer must also remove account data from the signed-out wheel.
        // The account's own session is independent and remains untouched.
        const adopted = await this.db.getAllAsync<{ id: string }>('SELECT id FROM library_records WHERE owner=?', '');
        const otherSessions = await this.db.getAllAsync<{ owner: string; session: string }>('SELECT owner,session FROM library_sessions WHERE owner<>?', did);
        for (const other of otherSessions) {
          let session = { ...JSON.parse(other.session), saved: [] } as ActiveSession;
          const ids = new Set(adopted.map(row => row.id));
          for (const instance of session.active) {
            if (instance.sourceId && ids.has(instance.sourceId)) session = removeInstance(session, instance.id);
          }
          await this.writeSession(other.owner, session);
        }
        // A collision must fail atomically, never overwrite either user's record.
        await this.db.runAsync('UPDATE library_records SET owner=? WHERE owner=?', did, '');
      }
      await this.db.runAsync('UPDATE library_accounts SET enabled=1 WHERE owner=?', did);
      for (const row of await this.db.getAllAsync<Row>('SELECT * FROM library_records WHERE owner=? AND dirty=1', did)) await this.enqueue(row);
      if (!authorize()) throw new Error('Account changed. Open sync settings again.');
    }));
  }
  disableSync(did: string): Promise<void> {
    return this.serial(() => this.transaction(async () => { await this.account(did); await this.db.runAsync('UPDATE library_accounts SET enabled=0 WHERE owner=?', did); }));
  }
  /** v2 includes records hidden from old clients, so replay the feed once. */
  prepareSettingsSync(did: string): Promise<void> {
    return this.serial(() => this.transaction(async () => {
      const key = `syncProtocol:${did}`;
      if (await this.db.getFirstAsync('SELECT value FROM library_meta WHERE key=?', key)) return;
      await this.account(did);
      await this.db.runAsync('UPDATE library_accounts SET cursor=0 WHERE owner=?', did);
      await this.db.runAsync('INSERT INTO library_meta(key,value) VALUES(?,?)', key, '2');
    }));
  }
  syncState(did: string): Promise<LibrarySyncState> {
    return this.serial(async () => {
      const account = await this.account(did);
      const count = await this.db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM library_records WHERE owner=? AND dirty=1', did);
      return { enabled: !!account.enabled, cursor: account.cursor, lastSyncedAt: account.last_synced, pending: count!.n, conflicts: account.conflicts };
    });
  }
  pending(did: string): Promise<SyncOperation[]> {
    return this.serial(async () => (await this.db.getAllAsync<{ operation: string }>('SELECT operation FROM library_outbox WHERE owner=? ORDER BY rowid LIMIT 100', did)).map(row => JSON.parse(row.operation)));
  }
  private async retainRemovedAccountCopy(did: string, record: SyncRecord, local: Row | null) {
    await this.db.runAsync('INSERT OR IGNORE INTO library_account_removals(owner,id) VALUES (?,?)', did, record.id);
    await this.db.runAsync('DELETE FROM library_outbox WHERE owner=? AND chart_id=?', did, record.id);
    // Retain the latest local content, including unsent edits, and deliberate
    // local deletions. Keeping the ID also preserves open chart source links.
    await this.db.runAsync('INSERT INTO library_records(owner,id,content,revision,dirty) VALUES (?,?,?,?,0) ON CONFLICT(owner,id) DO UPDATE SET revision=excluded.revision,dirty=0', did, record.id, local?.content ?? null, record.revision);
  }
  private async conflict(did: string, local: Row, remote: SyncRecord | null) {
    if (local.content !== null) {
      const content = JSON.parse(local.content) as ChartDraft;
      content.name = conflictName(content.name);
      const copy: Row = { owner: did, id: newChartId(), content: JSON.stringify(content), revision: 0, dirty: 1 };
      await this.db.runAsync('INSERT INTO library_records(owner,id,content,revision,dirty) VALUES (?,?,?,?,1)', did, copy.id, copy.content, 0);
      await this.enqueue(copy);
    }
    await this.account(did);
    await this.db.runAsync('UPDATE library_accounts SET conflicts=conflicts+1 WHERE owner=?', did);
    await this.db.runAsync('DELETE FROM library_outbox WHERE owner=? AND chart_id=?', did, local.id);
    await this.db.runAsync('UPDATE library_records SET content=?,revision=?,dirty=0 WHERE owner=? AND id=?', remote?.chart ? JSON.stringify(remote.chart) : null, remote?.revision ?? 0, did, local.id);
  }
  applyResults(did: string, sent: SyncOperation[], results: SyncResult[]): Promise<void> {
    return this.serial(() => this.transaction(async () => {
      if (results.length !== sent.length || new Set(results.map(r => r.operationId)).size !== sent.length) throw new Error('Incomplete sync acknowledgement');
      for (const operation of sent) {
        const result = results.find(item => item.operationId === operation.operationId);
        if (result?.record) validateRecord(result.record);
        if (!result || !['applied', 'replayed', 'conflict'].includes(result.outcome) || (result.record && result.record.id !== operation.chartId) || (result.outcome !== 'conflict' && (!result.record || result.record.revision <= operation.baseRevision))) throw new Error('Invalid sync acknowledgement');
        const queued = await this.db.getFirstAsync<{ operation: string }>('SELECT operation FROM library_outbox WHERE owner=? AND chart_id=?', did, operation.chartId);
        if (!queued || JSON.parse(queued.operation).operationId !== operation.operationId) continue;
        const local = (await this.db.getFirstAsync<Row>('SELECT * FROM library_records WHERE owner=? AND id=?', did, operation.chartId))!;
        if (result.record?.removedFromAccount) { await this.retainRemovedAccountCopy(did, result.record, local); continue; }
        if (result.outcome === 'conflict') { await this.conflict(did, local, result.record); continue; }
        const record = result.record!;
        await this.db.runAsync('DELETE FROM library_outbox WHERE owner=? AND chart_id=?', did, local.id);
        const changed = local.content !== (operation.chart === null ? null : JSON.stringify(operation.chart));
        // An acknowledged delete cannot be revived under its old ID.
        if (changed && record.chart === null) { await this.conflict(did, local, record); continue; }
        let content = changed ? local.content : record.chart === null ? null : JSON.stringify(record.chart);
        if (changed && content && operation.chart?.metadata === undefined && record.chart?.metadata !== undefined) {
          const latest = JSON.parse(content) as ChartDraft;
          if (latest.metadata === undefined) content = JSON.stringify({ ...latest, metadata: normalizeMetadata(record.chart.metadata) });
        }
        await this.db.runAsync('UPDATE library_records SET content=?,revision=?,dirty=? WHERE owner=? AND id=?', content, record.revision, changed ? 1 : 0, did, local.id);
        if (changed) await this.enqueue({ ...local, content, revision: record.revision, dirty: 1 });
      }
    }));
  }
  applyChanges(did: string, records: SyncRecord[], cursor: number): Promise<void> {
    return this.serial(() => this.transaction(async () => {
      const account = await this.account(did);
      for (const record of records) validateRecord(record);
      if (!Number.isSafeInteger(cursor) || cursor < account.cursor || records.some(record => record.revision > cursor)) throw new Error('Invalid sync cursor');
      for (const record of records) {
        const local = await this.db.getFirstAsync<Row>('SELECT * FROM library_records WHERE owner=? AND id=?', did, record.id);
        if (local && local.revision >= record.revision) continue;
        if (record.removedFromAccount) { await this.retainRemovedAccountCopy(did, record, local); continue; }
        if (local?.dirty) { await this.conflict(did, local, record); continue; }
        await this.db.runAsync('INSERT INTO library_records(owner,id,content,revision,dirty) VALUES (?,?,?,?,0) ON CONFLICT(owner,id) DO UPDATE SET content=excluded.content,revision=excluded.revision,dirty=0', did, record.id, record.chart === null ? null : JSON.stringify(record.chart), record.revision);
      }
      await this.db.runAsync('UPDATE library_accounts SET cursor=? WHERE owner=?', cursor, did);
    }));
  }
  /** Conversion receipts download account charts without enabling upload sync.
   * Do not advance the feed cursor or replace an edit/deletion queued locally. */
  acceptTransferredChart(did: string, record: SyncRecord, authorized: () => boolean): Promise<void> {
    return this.serial(() => this.transaction(async () => {
      validateRecord(record);
      if (!authorized()) throw new Error('Account changed');
      const local = await this.db.getFirstAsync<Row>('SELECT * FROM library_records WHERE owner=? AND id=?', did, record.id);
      if (record.removedFromAccount && (!local || local.revision < record.revision)) {
        await this.retainRemovedAccountCopy(did, record, local);
      } else if (!local?.dirty && (!local || local.revision < record.revision)) {
        await this.db.runAsync('INSERT INTO library_records(owner,id,content,revision,dirty) VALUES(?,?,?,?,0) ON CONFLICT(owner,id) DO UPDATE SET content=excluded.content,revision=excluded.revision,dirty=0', did, record.id, record.chart === null ? null : JSON.stringify(record.chart), record.revision);
      }
      if (!authorized()) throw new Error('Account changed');
    }));
  }
  markSynced(did: string): Promise<void> {
    return this.serial(() => this.transaction(async () => { await this.account(did); await this.db.runAsync('UPDATE library_accounts SET last_synced=? WHERE owner=?', new Date().toISOString(), did); }));
  }
}
export async function createChartLibraryStore(db: LibraryDatabase, readLegacy: () => Promise<string | null> = async () => null) { return new ChartLibraryStore(db, readLegacy).initialize(); }
let singleton: Promise<ChartLibraryStore> | undefined;
export function getChartLibrary(): Promise<ChartLibraryStore> {
  if (!singleton) singleton = openDatabaseAsync('kairos-chart-library-v1.db').then(async db => {
    try { return await createChartLibraryStore(db, () => AsyncStorage.getItem(ACTIVE_CHARTS_KEY)); }
    catch (error) { await db.closeAsync().catch(() => {}); throw error; }
  }).catch(error => { singleton = undefined; throw error; });
  return singleton;
}
