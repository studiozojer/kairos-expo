import { CryptoDigestAlgorithm, digestStringAsync } from 'expo-crypto';
import { isCurrentSession, type SessionSnapshot } from '@/auth/session';
import { validateDraft, type ChartDraft } from '../active/model';
import type { ChartLibraryStore } from '../library/store';
import type { SyncRecord } from '../library/types';
import { archiveRequest } from './api';
import type { ArchivedChart } from './types';

export const CONVERSION_PROFILE = 'swift-tropical-mean-v1';
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

/** Recover saved destinations after a lost acknowledgement or on another device.
 * This only downloads existing account charts, and never enables normal sync. */
export async function retrieveConvertedDestinations(records: ArchivedChart[], session: SessionSnapshot, signal: AbortSignal, library: ChartLibraryStore) {
  const destinations = records.filter(record => record.destinationChartId !== null);
  if (!destinations.length) return;
  for (const preview of await previewConversions(destinations, session, signal)) {
    const source = destinations.find(r => r.transferId === preview.transferId)!;
    if (!preview.record || preview.record.id !== source.destinationChartId) throw new Error('Saved destination changed. Refresh the archive.');
    await library.acceptTransferredChart(session.account.did, preview.record, () => !signal.aborted && isCurrentSession(session));
  }
}

export async function addTransferredChart(preview: ConversionPreview, reviewed: boolean, session: SessionSnapshot, signal: AbortSignal, library: ChartLibraryStore) {
  if (!['compatible', 'needs_review'].includes(preview.state) || (preview.state === 'needs_review' && !reviewed) || preview.profileVersion !== CONVERSION_PROFILE) throw new Error('Review compatibility before adding this chart');
  // The same source/version/review decision keeps its operation ID across app
  // restarts and ambiguous replies. Account ownership still comes from auth.
  const hash = await digestStringAsync(CryptoDigestAlgorithm.SHA256, `${CONVERSION_PROFILE}:${session.account.did}:${preview.snapshotId}:${reviewed}`);
  const operationId = `${hash.slice(0,8)}-${hash.slice(8,12)}-${hash.slice(12,16)}-${hash.slice(16,20)}-${hash.slice(20,32)}`;
  const result = await archiveRequest('/conversions', session, signal, { method: 'POST', body: JSON.stringify({ operationId, snapshotId: preview.snapshotId, classifierVersion: 'swift-preservation-v1', profileVersion: CONVERSION_PROFILE, acknowledgeReview: reviewed }) }) as {
    receipt: { operationId: string; snapshotId: string; transferId: string; profileVersion: string; destinationChartId: string; status: string }; record: SyncRecord;
  };
  const receipt = result?.receipt;
  if (!receipt || receipt.operationId !== operationId || receipt.snapshotId !== preview.snapshotId || receipt.transferId !== preview.transferId || receipt.profileVersion !== CONVERSION_PROFILE || receipt.status !== 'added'
    || !result.record || result.record.id !== receipt.destinationChartId) throw new Error('Invalid conversion acknowledgement. Retry to retrieve the saved chart.');
  await library.acceptTransferredChart(session.account.did, result.record, () => !signal.aborted && isCurrentSession(session));
  return result.record;
}

export const conversionReason = (reason: string): string => ({
  confirm_ordinary_chart: 'No saved source setting: confirm use of the stored date and location as an ordinary chart.',
  confirm_tropical_zodiac: 'No saved zodiac setting: confirm Tropical zodiac.',
  confirm_captured_settings: 'Confirm the captured Mean node, Mean Lilith and Traditional lot settings; historical settings are unknown.',
  confirm_stored_favorite: 'Favorite representations disagree: use the stored favorite flag.',
  confirm_empty_tags: 'No tag relationships were captured: use no tags.',
  sidereal_or_unknown_zodiac: 'Sidereal or unknown zodiac is not supported by this conversion.',
  derived_or_unknown_source: 'Derived or unknown chart source needs additional support.',
  source_input_disagreement: 'Stored source inputs disagree with the chart fields.',
  derived_or_ephemeral_chart: 'Derived or temporary chart cannot be added with this profile.',
  unsupported_captured_settings: 'Captured node, Lilith or lot settings are not supported.',
  setting_disagreement: 'Stored overrides disagree with supported captured settings.',
  subsecond_datetime: 'The stored time needs a precision review.',
  date_range: 'Date is outside the supported 1900–2099 range.',
  unsupported_location: 'Coordinates are invalid or outside the verified latitude range.',
  unknown_house_system: 'House system is missing or unsupported.',
  metadata_limit: 'Name, location or timezone needs review.',
  unresolved_tags: 'Some saved tag names lack matching tag records.',
  unsupported_tags: 'Tags exceed the supported limits or contain conflicts.',
  unreadable_zodiac: 'The original zodiac data could not be read.',
  unreadable_source: 'The original source data could not be read.',
  unknown_source_version: 'The source format needs additional support.',
  unknown_chart_kind: 'The chart type needs additional compatibility support.',
  unknown_timezone: 'The saved timezone is not supported.',
  invalid_destination: 'The saved fields cannot be represented in Saved Charts.',
  invalid_favorite: 'The stored favorite flag is invalid.',
}[reason] ?? 'This record needs additional compatibility support.');
