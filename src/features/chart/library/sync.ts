import { authorizedFetch, captureSession, isCurrentSession, renewSession, type SessionSnapshot } from '@/auth/session';
import { validateDraft } from '../active/model';
import type { ChartLibraryStore } from './store';
import type { SyncRecord, SyncResult } from './types';

export class SyncInterrupted extends Error {}
const validRevision = (n: unknown): n is number => Number.isSafeInteger(n) && (n as number) >= 0;
function record(value: unknown): asserts value is SyncRecord {
  const v = value as SyncRecord;
  if (!v || typeof v.id !== 'string' || !v.id || !validRevision(v.revision) || v.revision === 0 || typeof v.updatedAt !== 'string' || !Number.isFinite(Date.parse(v.updatedAt))) throw new Error('Invalid chart sync response');
  if (v.chart !== null) validateDraft(v.chart);
}

/** One foreground pass. The durable outbox, not this worker, owns retry state. */
export async function syncCharts(store: ChartLibraryStore, did: string, signal: AbortSignal, onChange: () => Promise<void> = async () => {}, session?: SessionSnapshot) {
  let captured = session ?? await captureSession();
  if (!captured || captured.account.did !== did) throw new SyncInterrupted('Sign in to sync this library');
  await store.prepareSettingsSync(did);
  // Verify token ownership and rotate expiring tokens before binding the pass.
  if (signal.aborted || !(await store.syncState(did)).enabled) throw new SyncInterrupted('Chart sync stopped');
  const renewal = new AbortController();
  const abortRenewal = () => renewal.abort();
  signal.addEventListener('abort', abortRenewal);
  const renewalTimer = setTimeout(abortRenewal, 15000);
  try { captured = await renewSession(captured, { signal: renewal.signal }); }
  finally { clearTimeout(renewalTimer); signal.removeEventListener('abort', abortRenewal); }
  if (!captured || captured.account.did !== did) throw new SyncInterrupted('Account changed');
  const bound = captured;
  const guard = async () => {
    const enabled = (await store.syncState(did)).enabled;
    if (signal.aborted || !isCurrentSession(bound) || !enabled) throw new SyncInterrupted('Chart sync stopped');
  };
  const request = async (path: string, init: RequestInit = {}) => {
    await guard();
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal.addEventListener('abort', abort);
    const timer = setTimeout(abort, 15000);
    try {
      const response = await authorizedFetch(`/api/chart-sync/v2${path}`, { ...init, signal: controller.signal }, bound);
      if (!response.ok) throw new Error(response.status === 404 ? 'Chart sync is not available on the server yet.' : `Chart sync failed (${response.status}). Your local charts are safe.`);
      const body: unknown = await response.json();
      await guard();
      return body;
    } finally { clearTimeout(timer); signal.removeEventListener('abort', abort); }
  };
  // Bound work per foreground pass; sustained edits continue on the next pass.
  for (let round = 0; round < 5; round++) {
    await guard();
    const operations = await store.pending(did);
    if (operations.length) {
      const body = await request('/push', { method: 'POST', body: JSON.stringify({ operations }) }) as { results: SyncResult[] };
      if (!Array.isArray(body?.results) || body.results.length !== operations.length) throw new Error('Incomplete chart sync response');
      body.results.forEach((result, index) => {
        if (result.operationId !== operations[index].operationId || !['applied', 'replayed', 'conflict'].includes(result.outcome)) throw new Error('Invalid chart sync acknowledgement');
        if (result.record !== null) { record(result.record); if (result.record.id !== operations[index].chartId) throw new Error('Mismatched chart sync identity'); }
        else if (result.outcome !== 'conflict') throw new Error('Missing chart sync acknowledgement');
      });
      await guard();
      await store.applyResults(did, operations, body.results);
      await onChange();
    }
    // Resolve all ambiguous acknowledgements before consuming the feed. New
    // edits while sending are rebased by the store into fresh operations.
    if ((await store.pending(did)).length) continue;
    let cursor = (await store.syncState(did)).cursor;
    for (let page = 0; page < 100; page++) {
      const body = await request(`/changes?cursor=${cursor}&limit=100`) as { records: SyncRecord[]; cursor: number; hasMore: boolean };
      if (!Array.isArray(body?.records) || body.records.length > 100 || !validRevision(body.cursor) || typeof body.hasMore !== 'boolean') throw new Error('Invalid chart change feed');
      let previous = cursor;
      for (const item of body.records) { record(item); if (item.revision <= previous) throw new Error('Out-of-order chart change feed'); previous = item.revision; }
      if (body.cursor !== previous || (body.hasMore && !body.records.length)) throw new Error('Invalid chart change cursor');
      await guard();
      await store.applyChanges(did, body.records, body.cursor);
      cursor = body.cursor;
      await onChange();
      if (!body.hasMore) break;
      if (page === 99) return;
    }
    await guard();
    if (!(await store.pending(did)).length) {
      await store.markSynced(did);
      await onChange();
      return;
    }
  }
}
