import AsyncStorage from '@react-native-async-storage/async-storage';
import { openDatabaseAsync } from 'expo-sqlite';
import { ACTIVE_CHARTS_KEY, initialSession, newChartId, parseSession, snapshotSettings, validateDraft, type ActiveSession, type ChartDraft, type SavedChart } from '../active/model';
import type { ChartSettings } from '../settings/chartSettings';
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
  if (record.chart !== null) validateDraft(record.chart);
}
const schema = `
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS library_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS library_records (owner TEXT NOT NULL, id TEXT NOT NULL, content TEXT, revision INTEGER NOT NULL DEFAULT 0, dirty INTEGER NOT NULL DEFAULT 1, PRIMARY KEY(owner,id));
CREATE TABLE IF NOT EXISTS library_sessions (owner TEXT PRIMARY KEY, session TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS library_accounts (owner TEXT PRIMARY KEY, enabled INTEGER NOT NULL DEFAULT 0, cursor INTEGER NOT NULL DEFAULT 0, last_synced TEXT, conflicts INTEGER NOT NULL DEFAULT 0);
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
      const rows = await this.db.getAllAsync<Row>('SELECT * FROM library_records WHERE (owner = ? OR owner = ?) AND content IS NOT NULL ORDER BY rowid', '', owner);
      const saved = rows.map(row => ({ ...JSON.parse(row.content!), id: row.id } as SavedChart));
      const stored = await this.db.getFirstAsync<{ session: string }>('SELECT session FROM library_sessions WHERE owner = ?', owner);
      const session: ActiveSession = stored ? { ...JSON.parse(stored.session), saved } : { ...initialSession(defaults), saved };
      session.active = session.active.map(chart => chart.sourceId && !saved.some(source => source.id === chart.sourceId) ? { ...chart, kind: 'snapshot', sourceId: undefined } : chart);
      return parseSession(JSON.stringify(session));
    });
  }
  saveSession(scope: string | null, session: ActiveSession): Promise<void> {
    const snapshot = JSON.parse(JSON.stringify(session)) as ActiveSession;
    return this.serial(() => this.transaction(() => this.writeSession(ownerKey(scope), snapshot)));
  }
  private async account(owner: string) {
    await this.db.runAsync('INSERT OR IGNORE INTO library_accounts(owner) VALUES (?)', owner);
    return (await this.db.getFirstAsync<Account>('SELECT * FROM library_accounts WHERE owner = ?', owner))!;
  }
  private async enqueue(row: Row) {
    if (!row.owner || !row.dirty) return;
    // Keeping operations immutable makes a response lost after server commit safe to retry.
    const operation: SyncOperation = { operationId: newChartId(), chartId: row.id, baseRevision: row.revision, chart: row.content === null ? null : JSON.parse(row.content) };
    await this.db.runAsync('INSERT OR IGNORE INTO library_outbox(owner,chart_id,operation) VALUES (?,?,?)', row.owner, row.id, JSON.stringify(operation));
  }
  saveChart(scope: string | null, draft: ChartDraft, id?: string): Promise<SavedChart> {
    validateDraft(draft);
    if (draft.name.trim().length > 200 || draft.settings.location.name.length > 300 || draft.settings.location.timezone.length > 100) return Promise.reject(new Error('Chart or location name is too long'));
    const chart: SavedChart = { id: id ?? newChartId(), name: draft.name.trim(), datetime: new Date(draft.datetime).toISOString(), settings: snapshotSettings(draft.settings) };
    return this.serial(() => this.transaction(async () => {
      const owner = ownerKey(scope);
      const existing = id ? await this.db.getFirstAsync<Row>('SELECT * FROM library_records WHERE id = ? AND (owner = ? OR owner = ?)', id, owner, '') : null;
      if (id && (!existing || existing.content === null)) throw new Error('Saved chart is no longer available');
      const { id: chartId, ...content } = chart;
      const row: Row = { owner: existing?.owner ?? owner, id: chartId, content: JSON.stringify(content), revision: existing?.revision ?? 0, dirty: 1 };
      await this.db.runAsync('INSERT INTO library_records(owner,id,content,revision,dirty) VALUES (?,?,?,?,1) ON CONFLICT(owner,id) DO UPDATE SET content=excluded.content,dirty=1', row.owner, row.id, row.content, row.revision);
      await this.enqueue(row);
      return chart;
    }));
  }
  deleteChart(scope: string | null, id: string): Promise<void> {
    return this.serial(() => this.transaction(async () => {
      const row = await this.db.getFirstAsync<Row>('SELECT * FROM library_records WHERE id = ? AND (owner = ? OR owner = ?)', id, ownerKey(scope), '');
      if (!row || row.content === null) return;
      await this.db.runAsync('UPDATE library_records SET content=NULL,dirty=1 WHERE owner=? AND id=?', row.owner, id);
      await this.enqueue({ ...row, content: null, dirty: 1 });
    }));
  }
  enableSync(did: string, includeAnonymous: boolean): Promise<void> {
    return this.serial(() => this.transaction(async () => {
      await this.account(did);
      if (includeAnonymous) {
        // A collision must fail atomically, never overwrite either user's record.
        await this.db.runAsync('UPDATE library_records SET owner=? WHERE owner=?', did, '');
      }
      await this.db.runAsync('UPDATE library_accounts SET enabled=1 WHERE owner=?', did);
      for (const row of await this.db.getAllAsync<Row>('SELECT * FROM library_records WHERE owner=? AND dirty=1', did)) await this.enqueue(row);
    }));
  }
  disableSync(did: string): Promise<void> {
    return this.serial(() => this.transaction(async () => { await this.account(did); await this.db.runAsync('UPDATE library_accounts SET enabled=0 WHERE owner=?', did); }));
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
  private async conflict(did: string, local: Row, remote: SyncRecord | null) {
    if (local.content !== null) {
      const content = JSON.parse(local.content) as ChartDraft;
      content.name = `${content.name.slice(0, 184)} (conflict copy)`;
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
        if (result.outcome === 'conflict') { await this.conflict(did, local, result.record); continue; }
        const record = result.record!;
        await this.db.runAsync('DELETE FROM library_outbox WHERE owner=? AND chart_id=?', did, local.id);
        const changed = local.content !== (operation.chart === null ? null : JSON.stringify(operation.chart));
        // An acknowledged delete cannot be revived under its old ID.
        if (changed && record.chart === null) { await this.conflict(did, local, record); continue; }
        await this.db.runAsync('UPDATE library_records SET revision=?,dirty=? WHERE owner=? AND id=?', record.revision, changed ? 1 : 0, did, local.id);
        if (changed) await this.enqueue({ ...local, revision: record.revision, dirty: 1 });
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
        if (local?.dirty) { await this.conflict(did, local, record); continue; }
        await this.db.runAsync('INSERT INTO library_records(owner,id,content,revision,dirty) VALUES (?,?,?,?,0) ON CONFLICT(owner,id) DO UPDATE SET content=excluded.content,revision=excluded.revision,dirty=0', did, record.id, record.chart === null ? null : JSON.stringify(record.chart), record.revision);
      }
      await this.db.runAsync('UPDATE library_accounts SET cursor=? WHERE owner=?', cursor, did);
    }));
  }
  markSynced(did: string): Promise<void> {
    return this.serial(() => this.transaction(async () => { await this.account(did); await this.db.runAsync('UPDATE library_accounts SET last_synced=? WHERE owner=?', new Date().toISOString(), did); }));
  }
}
export async function createChartLibraryStore(db: LibraryDatabase, readLegacy: () => Promise<string | null> = async () => null) { return new ChartLibraryStore(db, readLegacy).initialize(); }
let singleton: Promise<ChartLibraryStore> | undefined;
export function getChartLibrary(): Promise<ChartLibraryStore> {
  if (!singleton) singleton = openDatabaseAsync('kairos-chart-library-v1.db').then(db => createChartLibraryStore(db, () => AsyncStorage.getItem(ACTIVE_CHARTS_KEY))).catch(error => { singleton = undefined; throw error; });
  return singleton;
}
