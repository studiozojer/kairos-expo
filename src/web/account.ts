import { validateDraft, type SavedChart } from '../features/chart/active/model';
import type { SyncRecord } from '../features/chart/library/types';
import { validateArchiveRecord, type ArchiveRecord } from '../features/chart/transfers/types';
import type { ConversionPreview } from '../features/chart/transfers/conversion';

export interface Account { did: string; handle: string }

export async function localRequest<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  // Only local, purpose-specific operations; the bridge has no generic proxy.
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(`/local/${path}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body), signal,
    });
    if (response.status === 429 && attempt < 2) {
      await new Promise<void>((resolve, reject) => {
        const stop = () => { clearTimeout(timer); reject(new Error('Download cancelled')); };
        const timer = setTimeout(() => { signal?.removeEventListener('abort', stop); resolve(); }, 3000 * (attempt + 1));
        if (signal?.aborted) stop();
        else signal?.addEventListener('abort', stop, { once: true });
      });
      continue;
    }
    const value = await response.json();
    if (!response.ok) throw new Error(value.error ?? `Request failed (${response.status})`);
    return value as T;
  }
  throw new Error('The account server is busy. Try again shortly.');
}

function validateFeed<T extends { revision: number }>(body: { records: T[]; cursor: number; hasMore: boolean }, cursor: number) {
  if (!body || !Array.isArray(body.records) || body.records.length > 100 || typeof body.hasMore !== 'boolean') throw new Error('Invalid account chart feed');
  let previous = cursor;
  for (const record of body.records) {
    if (!Number.isSafeInteger(record.revision) || record.revision <= previous) throw new Error('Invalid account chart order');
    previous = record.revision;
  }
  if (body.cursor !== previous || (body.hasMore && !body.records.length)) throw new Error('Invalid account chart cursor');
}

/** Read account copies and compatibility previews. Never converts or uploads. */
export async function loadAccountCharts(signal: AbortSignal, progress: (message: string) => void) {
  const charts = new Map<string, SavedChart>();
  const archive = new Map<string, ArchiveRecord>();
  let cursor = 0;
  for (let page = 0; ; page++) {
    if (page === 1000) throw new Error('The chart library is too large for one download.');
    const body = await localRequest<{ records: SyncRecord[]; cursor: number; hasMore: boolean }>(`changes?cursor=${cursor}`, undefined, signal);
    validateFeed(body, cursor);
    for (const record of body.records) {
      if (typeof record.id !== 'string' || !record.id) throw new Error('Invalid account chart identity');
      if (record.chart === null) charts.delete(record.id);
      else { validateDraft(record.chart); charts.set(record.id, { ...record.chart, id: record.id }); }
    }
    progress(`Loaded ${charts.size} saved charts…`);
    cursor = body.cursor;
    if (!body.hasMore) break;
  }
  cursor = 0;
  let exceptions = 0;
  // Account charts can include preserved Swift transfers that haven't been
  // converted into an Expo record. Preview these without writing a conversion.
  for (let page = 0; ; page++) {
    if (page === 1000) throw new Error('The transferred library is too large for one download.');
    const body = await localRequest<{ records: ArchiveRecord[]; cursor: number; hasMore: boolean }>(`transfers?cursor=${cursor}`, undefined, signal);
    validateFeed(body, cursor);
    for (const record of body.records) { validateArchiveRecord(record); archive.set(record.transferId, record); }
    cursor = body.cursor;
    if (!body.hasMore) break;
  }
  const records = [...archive.values()].filter(record => !record.tombstone);
  for (let start = 0; start < records.length; start += 100) {
    const batch = records.slice(start, start + 100);
    const body = await localRequest<{ previews: ConversionPreview[] }>('previews', { snapshotIds: batch.map(record => record.snapshotId) }, signal);
    if (!Array.isArray(body.previews) || body.previews.length !== batch.length) throw new Error('Incomplete transferred chart response');
    body.previews.forEach((preview, index) => {
      if (preview.snapshotId !== batch[index].snapshotId || preview.transferId !== batch[index].transferId) throw new Error('Invalid transferred chart identity');
      if (preview.record?.chart) {
        validateDraft(preview.record.chart);
        charts.set(preview.record.id, { ...preview.record.chart, id: preview.record.id });
      } else if (preview.state === 'compatible' && preview.chart) {
        validateDraft(preview.chart);
        const id = `transfer:${preview.transferId}`;
        charts.set(id, { ...preview.chart, id });
      } else if (!batch[index].destinationChartId || !charts.has(batch[index].destinationChartId!)) exceptions++;
    });
    progress(`Loaded ${charts.size} charts…`);
  }
  return { charts: [...charts.values()].sort((a, b) => a.name.localeCompare(b.name)), exceptions };
}
