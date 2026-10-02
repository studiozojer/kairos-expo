export const SWIFT_CHART_NAMESPACE = 'studio.zojer.kairos-swift.chartentity';
export const PAYLOAD_ENCODING = 'kairos-swift-json-v1';
export interface Compatibility {
  state: 'ready' | 'unsupported' | 'needs_review' | 'invalid_source';
  reasons: string[];
  classifierVersion: string;
}
export interface ArchiveRecord {
  transferId: string; sourceNamespace: string; sourceRecordId: string;
  snapshotId: string; payloadDigest: string; payloadEncoding: string;
  revision: number; receivedAt: string; compatibility: Compatibility;
  destinationChartId: string | null;
  parentSourceRecordId: string | null; parentTransferId: string | null;
  tombstone: boolean;
}
export interface ArchiveSnapshot { snapshotId: string; payloadBytesBase64: string; payloadDigest: string; payloadEncoding: string }
export interface ArchivedChart extends ArchiveRecord { name: string }
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
export const validRevision = (value: unknown): value is number => Number.isSafeInteger(value) && (value as number) >= 0;
export function validateArchiveRecord(value: unknown): asserts value is ArchiveRecord {
  const v = value as ArchiveRecord;
  if (!v || !uuid(v.transferId) || !uuid(v.snapshotId) || typeof v.sourceNamespace !== 'string' || !v.sourceNamespace || typeof v.sourceRecordId !== 'string' || !v.sourceRecordId
    || typeof v.payloadDigest !== 'string' || !/^[0-9a-f]{64}$/.test(v.payloadDigest) || typeof v.payloadEncoding !== 'string' || !v.payloadEncoding
    || !validRevision(v.revision) || v.revision === 0 || typeof v.receivedAt !== 'string' || !Number.isFinite(Date.parse(v.receivedAt)) || typeof v.tombstone !== 'boolean'
    || !(v.destinationChartId === null || (typeof v.destinationChartId === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(v.destinationChartId)))
    || !(v.parentSourceRecordId === null || uuid(v.parentSourceRecordId)) || !(v.parentTransferId === null || uuid(v.parentTransferId))
    || !v.compatibility || !['ready', 'unsupported', 'needs_review', 'invalid_source'].includes(v.compatibility.state)
    || !Array.isArray(v.compatibility.reasons) || v.compatibility.reasons.length > 100 || !v.compatibility.reasons.every(r => typeof r === 'string' && r.length <= 128)
    || typeof v.compatibility.classifierVersion !== 'string' || !v.compatibility.classifierVersion) throw new Error('Invalid transfer archive response');
}
export function compatibilityLabel(value: Compatibility): string {
  switch (value.state) {
    case 'ready': return 'Saved in your account · Assessed ready';
    case 'unsupported': return 'Saved in your account · Opening support not available yet';
    case 'needs_review': return 'Saved in your account · Needs compatibility review';
    case 'invalid_source': return 'Saved in your account · Source data needs attention';
  }
}
