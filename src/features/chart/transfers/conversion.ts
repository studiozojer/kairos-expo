import { CryptoDigestAlgorithm, digestStringAsync } from 'expo-crypto';
import { isCurrentSession, type SessionSnapshot } from '@/auth/session';
import { validateDraft, type ChartDraft } from '../active/model';
import type { ChartLibraryStore } from '../library/store';
import type { SyncRecord } from '../library/types';
import { archiveRequest } from './api';
import type { ArchivedChart } from './types';

export const CONVERSION_PROFILE = 'swift-tropical-automatic-v3';
export interface ConversionPreview {
  transferId: string; snapshotId: string; profileVersion: string;
  state: 'compatible' | 'needs_review' | 'unsupported' | 'already_added' | 'source_changed' | 'deleted';
  reasons: string[]; chart: ChartDraft | null; destinationChartId: string | null; record: SyncRecord | null;
}
export async function previewConversions(records: ArchivedChart[], session: SessionSnapshot, signal: AbortSignal): Promise<ConversionPreview[]> {
  const capabilities = await archiveRequest('/capabilities', session, signal) as { conversionProfile?: unknown };
  if (capabilities.conversionProfile !== CONVERSION_PROFILE) throw new Error('Adding transferred charts is not enabled on the server yet. Your archive remains saved.');
  const previews: ConversionPreview[] = [];
  for (let start = 0; start < records.length; start += 100) {
    const page = records.slice(start, start + 100);
    const response = await archiveRequest('/conversion-previews', session, signal, { method: 'POST', body: JSON.stringify({ snapshotIds: page.map(r => r.snapshotId) }) }) as { previews: ConversionPreview[] };
    if (!Array.isArray(response?.previews) || response.previews.length !== page.length) throw new Error('Incomplete compatibility assessment. Check again before adding charts.');
    response.previews.forEach((preview, index) => {
      if (preview.transferId !== page[index].transferId || preview.snapshotId !== page[index].snapshotId || preview.profileVersion !== CONVERSION_PROFILE
        || !['compatible', 'needs_review', 'unsupported', 'already_added', 'source_changed', 'deleted'].includes(preview.state)
        || !Array.isArray(preview.reasons) || preview.reasons.length > 100 || !preview.reasons.every(r => typeof r === 'string' && r.length < 128)) throw new Error('Invalid compatibility assessment');
      if (preview.state === 'compatible' || preview.state === 'needs_review') {
        if (!preview.chart || preview.destinationChartId !== null) throw new Error('Invalid conversion proposal');
        validateDraft(preview.chart);
      } else if (preview.chart !== null) throw new Error('Invalid conversion proposal');
      if (preview.destinationChartId !== null && (typeof preview.destinationChartId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(preview.destinationChartId) || !preview.record || preview.record.id !== preview.destinationChartId)) throw new Error('Invalid saved destination');
    });
    previews.push(...response.previews);
  }
  return previews;
}

export async function addTransferredChart(preview: ConversionPreview, session: SessionSnapshot, signal: AbortSignal, library: ChartLibraryStore) {
  if (preview.state !== 'compatible' || preview.profileVersion !== CONVERSION_PROFILE) throw new Error('This chart needs additional compatibility support');
  // The same source/version/automatic policy keeps its operation ID across app
  // restarts and ambiguous replies. Account ownership still comes from auth.
  const hash = await digestStringAsync(CryptoDigestAlgorithm.SHA256, `${CONVERSION_PROFILE}:${session.account.did}:${preview.snapshotId}:automatic`);
  const operationId = `${hash.slice(0,8)}-${hash.slice(8,12)}-${hash.slice(12,16)}-${hash.slice(16,20)}-${hash.slice(20,32)}`;
  const result = await archiveRequest('/conversions', session, signal, { method: 'POST', body: JSON.stringify({ operationId, snapshotId: preview.snapshotId, classifierVersion: 'swift-preservation-v1', profileVersion: CONVERSION_PROFILE, acknowledgeReview: false }) }) as {
    receipt: { operationId: string; snapshotId: string; transferId: string; profileVersion: string; destinationChartId: string; status: string }; record: SyncRecord;
  };
  const receipt = result?.receipt;
  if (!receipt || receipt.operationId !== operationId || receipt.snapshotId !== preview.snapshotId || receipt.transferId !== preview.transferId || receipt.profileVersion !== CONVERSION_PROFILE || receipt.status !== 'added'
    || !result.record || result.record.id !== receipt.destinationChartId) throw new Error('Invalid conversion acknowledgement. Retry to retrieve the saved chart.');
  await library.acceptTransferredChart(session.account.did, result.record, () => !signal.aborted && isCurrentSession(session));
  return result.record;
}

/** Assess and ingest without user-facing migration steps or fabricated review. */
export async function importAccountArchive(records: ArchivedChart[], session: SessionSnapshot, signal: AbortSignal, library: ChartLibraryStore, changed: () => Promise<void>, assessed: (previews: ConversionPreview[]) => void) {
  const current = () => !signal.aborted && isCurrentSession(session);
  // Each page publishes exceptions and saved charts before the next page.
  const result: ConversionPreview[] = [];
  if (!current()) throw new Error('Account changed');
  assessed([]);
  for (let start = 0; start < records.length; start += 100) {
    const previews = await previewConversions(records.slice(start, start + 100), session, signal);
    if (!current()) throw new Error('Account changed');
    result.push(...previews); assessed([...result]);
    let existingDownloaded = false;
    for (const preview of previews) {
      if (!current()) throw new Error('Account changed');
      let downloaded = false;
      if (preview.state === 'compatible') {
        const record = await addTransferredChart(preview, session, signal, library);
        const index = result.findIndex(p => p.transferId === preview.transferId);
        result[index] = { ...preview, state: 'already_added', chart: null, destinationChartId: record.id, record };
        downloaded = true;
      } else if (preview.record) {
        await library.acceptTransferredChart(session.account.did, preview.record, current);
        existingDownloaded = true;
      }
      if (!current()) throw new Error('Account changed');
      assessed([...result]);
      if (downloaded) await changed();
    }
    if (existingDownloaded) await changed();
  }
  return result;
}
