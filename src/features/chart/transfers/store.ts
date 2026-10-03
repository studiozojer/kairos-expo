import { openDatabaseAsync } from 'expo-sqlite';
import type { LibraryDatabase } from '../library/store';
import { decodeSnapshot } from './encoding';
import { PAYLOAD_ENCODING, SWIFT_CHART_NAMESPACE, validateArchiveRecord, validRevision, type ArchivedChart, type ArchiveRecord, type ArchiveSnapshot } from './types';

const schema = `
PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS archive_accounts(owner TEXT PRIMARY KEY,cursor INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS archive_records(owner TEXT NOT NULL,transfer_id TEXT NOT NULL,record TEXT NOT NULL,PRIMARY KEY(owner,transfer_id));
CREATE TABLE IF NOT EXISTS archive_snapshots(owner TEXT NOT NULL,snapshot_id TEXT NOT NULL,digest TEXT NOT NULL,encoding TEXT NOT NULL,bytes TEXT NOT NULL,PRIMARY KEY(owner,snapshot_id));
`;
export class ChartArchiveStore {
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private db: LibraryDatabase) {}
  private serial<T>(work: () => Promise<T>): Promise<T> {
    const next = this.queue.then(work); this.queue = next.catch(() => {}); return next;
  }
  async initialize() { await this.db.execAsync(schema); return this; }
  cursor(did: string): Promise<number> {
    return this.serial(async () => (await this.db.getFirstAsync<{ cursor: number }>('SELECT cursor FROM archive_accounts WHERE owner=?', did))?.cursor ?? 0);
  }
  snapshot(did: string, id: string): Promise<ArchiveSnapshot | null> {
    return this.serial(async () => {
      const row = await this.db.getFirstAsync<{ snapshot_id: string; digest: string; encoding: string; bytes: string }>('SELECT * FROM archive_snapshots WHERE owner=? AND snapshot_id=?', did, id);
      return row ? { snapshotId: row.snapshot_id, payloadDigest: row.digest, payloadEncoding: row.encoding, payloadBytesBase64: row.bytes } : null;
    });
  }
  list(did: string): Promise<ArchivedChart[]> {
    return this.serial(async () => {
      const rows = await this.db.getAllAsync<{ record: string; bytes: string | null }>('SELECT r.record,s.bytes FROM archive_records r LEFT JOIN archive_snapshots s ON s.owner=r.owner AND s.snapshot_id=json_extract(r.record,\'$.snapshotId\') WHERE r.owner=?', did);
      return rows.flatMap(row => {
        const record: ArchiveRecord = JSON.parse(row.record); validateArchiveRecord(record);
        if (record.sourceNamespace !== SWIFT_CHART_NAMESPACE || record.tombstone) return [];
        let name = 'Transferred chart';
        if (row.bytes && record.payloadEncoding === PAYLOAD_ENCODING) {
          const decoded = decodeSnapshot(row.bytes) as { chart?: { name?: unknown } };
          if (typeof decoded.chart?.name === 'string') name = decoded.chart.name;
        }
        return [{ ...record, name }];
      });
    });
  }
  applyPage(did: string, start: number, records: ArchiveRecord[], cursor: number, snapshots: ArchiveSnapshot[], authorized: () => boolean): Promise<void> {
    return this.serial(async () => {
      if (!authorized()) throw new Error('Account changed');
      let previous = start;
      for (const record of records) { validateArchiveRecord(record); if (record.revision <= previous) throw new Error('Out-of-order archive page'); previous = record.revision; }
      if (!validRevision(cursor) || cursor !== previous) throw new Error('Invalid archive cursor');
      await this.db.execAsync('BEGIN IMMEDIATE');
      try {
        const stored = (await this.db.getFirstAsync<{ cursor: number }>('SELECT cursor FROM archive_accounts WHERE owner=?', did))?.cursor ?? 0;
        if (stored !== start) throw new Error('Archive changed during download; retry');
        for (const snapshot of snapshots) {
          const old = await this.db.getFirstAsync<{ bytes: string; digest: string; encoding: string }>('SELECT bytes,digest,encoding FROM archive_snapshots WHERE owner=? AND snapshot_id=?', did, snapshot.snapshotId);
          if (old && (old.bytes !== snapshot.payloadBytesBase64 || old.digest !== snapshot.payloadDigest || old.encoding !== snapshot.payloadEncoding)) throw new Error('Immutable archive snapshot changed');
          await this.db.runAsync('INSERT INTO archive_snapshots(owner,snapshot_id,digest,encoding,bytes) VALUES(?,?,?,?,?) ON CONFLICT DO NOTHING', did, snapshot.snapshotId, snapshot.payloadDigest, snapshot.payloadEncoding, snapshot.payloadBytesBase64);
        }
        for (const record of records) {
          if (!record.tombstone) {
            const bytes = await this.db.getFirstAsync<{ digest: string; encoding: string }>('SELECT digest,encoding FROM archive_snapshots WHERE owner=? AND snapshot_id=?', did, record.snapshotId);
            if (!bytes || bytes.digest !== record.payloadDigest || bytes.encoding !== record.payloadEncoding) throw new Error('Archive snapshot not downloaded');
          }
          await this.db.runAsync('INSERT INTO archive_records(owner,transfer_id,record) VALUES(?,?,?) ON CONFLICT(owner,transfer_id) DO UPDATE SET record=excluded.record', did, record.transferId, JSON.stringify(record));
        }
        await this.db.runAsync('INSERT INTO archive_accounts(owner,cursor) VALUES(?,?) ON CONFLICT(owner) DO UPDATE SET cursor=excluded.cursor', did, cursor);
        if (!authorized()) throw new Error('Account changed');
        await this.db.execAsync('COMMIT');
      } catch (error) { await this.db.execAsync('ROLLBACK'); throw error; }
    });
  }
}
let singleton: Promise<ChartArchiveStore> | null = null;
export function getChartArchive() {
  if (!singleton) singleton = openDatabaseAsync('kairos-chart-transfers-v1.db').then(db => new ChartArchiveStore(db).initialize()).catch(error => { singleton = null; throw error; });
  return singleton;
}
