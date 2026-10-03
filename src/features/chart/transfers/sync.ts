import { archiveRequest } from './api';
import { captureSession, isCurrentSession, type SessionSnapshot } from '@/auth/session';
import { verifySnapshot } from './encoding';
import type { ChartArchiveStore } from './store';
import { validateArchiveRecord, validRevision, type ArchiveRecord, type ArchiveSnapshot } from './types';

export { ArchiveDownloadError } from './api';

/** Read-only archive retrieval. Never enables chart sync or uploads local charts. */
export async function retrieveArchive(store: ChartArchiveStore, did: string, signal: AbortSignal,
  changed: () => Promise<void> = async () => {}, expected?: SessionSnapshot) {
  const session = expected ?? await captureSession();
  if (!session || session.account.did !== did) throw new Error('Sign in to retrieve transferred charts');
  const current = () => !signal.aborted && isCurrentSession(session);
  const request = (path: string) => archiveRequest(path, session, signal);
  const capabilities = await request('/capabilities') as { envelopeVersions?: unknown; sourceNamespaces?: unknown };
  if (!Array.isArray(capabilities?.envelopeVersions) || !capabilities.envelopeVersions.includes(1)) throw new Error('Transferred charts require an updated server.');
  let cursor = await store.cursor(did);
  for (let page = 0; page < 100; page++) {
    const body = await request(`/changes?cursor=${cursor}&limit=100`) as { records: ArchiveRecord[]; cursor: number; hasMore: boolean };
    if (!Array.isArray(body?.records) || body.records.length > 100 || !validRevision(body.cursor) || typeof body.hasMore !== 'boolean') throw new Error('Invalid archive change feed');
    let previous = cursor;
    const snapshots: ArchiveSnapshot[] = [];
    for (const record of body.records) {
      validateArchiveRecord(record);
      if (record.revision <= previous) throw new Error('Out-of-order archive feed'); previous = record.revision;
      if (record.tombstone) continue;
      const cached = await store.snapshot(did, record.snapshotId);
      snapshots.push(await verifySnapshot(cached ?? await request(`/snapshots/${record.snapshotId}`), record));
    }
    if (body.cursor !== previous || (body.hasMore && !body.records.length)) throw new Error('Invalid archive cursor');
    if (!current()) throw new Error('Archive download stopped');
    await store.applyPage(did, cursor, body.records, body.cursor, snapshots, current);
    cursor = body.cursor; await changed();
    if (!body.hasMore) return;
  }
}
