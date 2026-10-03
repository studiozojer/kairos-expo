import { createHash } from 'node:crypto';
import { authorizedFetch, captureSession, isCurrentSession, type SessionSnapshot } from '@/auth/session';
import { testDatabase } from '../../library/test-support/sqlite';
import { ChartArchiveStore } from '../store';
import { retrieveArchive } from '../sync';
import { archiveDestination } from '../open';
import { verifySnapshot } from '../encoding';
import { SWIFT_CHART_NAMESPACE, type ArchiveRecord, type ArchiveSnapshot } from '../types';
import { DEFAULT_SETTINGS } from '../../settings/chartSettings';

jest.mock('@/auth/session', () => ({ authorizedFetch: jest.fn(), captureSession: jest.fn(), isCurrentSession: jest.fn() }));
jest.mock('expo-crypto', () => ({ CryptoDigestAlgorithm: { SHA256: 'SHA-256' }, digest: jest.fn(async (_algorithm: string, data: Uint8Array) => Uint8Array.from(jest.requireActual<typeof import('node:crypto')>('node:crypto').createHash('sha256').update(data).digest()).buffer) }));
const did = 'did:plc:archivea';
const uid = (number: number) => `00000000-0000-4000-8000-${number.toString().padStart(12, '0')}`;
function fixture(index = 1, state: ArchiveRecord['compatibility']['state'] = 'unsupported') {
  const raw = JSON.stringify({ payloadVersion: 1, chart: { id: uid(index), name: `Fixture ${index}`, datetime: -2208988801, source: { state: 'invalid', bytes: 'AP8=' }, zodiac: { state: 'decoded', bytes: 'e30=' } } });
  const digest = createHash('sha256').update(raw).digest('hex');
  const record: ArchiveRecord = { transferId: uid(index), sourceNamespace: SWIFT_CHART_NAMESPACE, sourceRecordId: uid(index), snapshotId: uid(index + 100), payloadDigest: digest, payloadEncoding: 'kairos-swift-json-v1', revision: index, receivedAt: '2026-10-02T00:00:00Z', compatibility: { state, reasons: ['date_range'], classifierVersion: 'fixture-v1' }, destinationChartId: null, parentSourceRecordId: null, parentTransferId: null, tombstone: false };
  const snapshot: ArchiveSnapshot = { snapshotId: record.snapshotId, payloadDigest: digest, payloadEncoding: record.payloadEncoding, payloadBytesBase64: Buffer.from(raw).toString('base64') };
  return { record, snapshot };
}
let database: ReturnType<typeof testDatabase>;
let current: SessionSnapshot;
let records: ArchiveRecord[];
let snapshots: Map<string, ArchiveSnapshot>;
let calls: string[];
let beforeResponse: (() => void) | undefined;
beforeEach(() => {
  database = testDatabase(); current = { account: { did, handle: 'fixture.test' }, token: 'fixture-token', generation: 1 };
  records = []; snapshots = new Map(); calls = []; beforeResponse = undefined;
  jest.mocked(captureSession).mockImplementation(async () => current);
  jest.mocked(isCurrentSession).mockImplementation(value => value === current);
  jest.mocked(authorizedFetch).mockImplementation(async path => {
    const route = String(path); calls.push(route);
    let body: unknown;
    if (route.endsWith('capabilities')) body = { envelopeVersions: [1] };
    else if (route.includes('/snapshots/')) body = snapshots.get(route.split('/').at(-1)!);
    else {
      const cursor = Number(new URL(route, 'https://fixture.invalid').searchParams.get('cursor'));
      const page = records.filter(r => r.revision > cursor);
      body = { records: page, cursor: page.at(-1)?.revision ?? cursor, hasMore: false };
    }
    beforeResponse?.(); beforeResponse = undefined;
    return { ok: true, text: async () => JSON.stringify(body) } as Response;
  });
});
afterEach(() => database.close());
const store = () => new ChartArchiveStore(database.db).initialize();
const run = (value: ChartArchiveStore) => retrieveArchive(value, did, new AbortController().signal);
function receive(value: ReturnType<typeof fixture>) { records.push(value.record); snapshots.set(value.snapshot.snapshotId, value.snapshot); }

it('downloads mixed records without calculation validation and retains original bytes after restart', async () => {
  receive(fixture(1, 'unsupported')); receive(fixture(2, 'invalid_source')); receive(fixture(3, 'needs_review'));
  const first = await store(); await run(first);
  expect((await first.list(did)).map(r => r.compatibility.state)).toEqual(['unsupported', 'invalid_source', 'needs_review']);
  expect(await first.cursor(did)).toBe(3);
  expect(await first.snapshot(did, uid(101))).toEqual(fixture().snapshot);
  const restarted = await store(); expect(await restarted.cursor(did)).toBe(3); expect(await restarted.list(did)).toHaveLength(3);
  expect(await restarted.list('did:plc:other')).toEqual([]);
  expect(await restarted.snapshot('did:plc:other', uid(101))).toBeNull();
  expect(calls.every(path => path.startsWith('/api/chart-transfers/v1/'))).toBe(true);
});
it('a failed snapshot does not advance the page cursor or retain a partial page', async () => {
  receive(fixture(1)); receive(fixture(2)); snapshots.set(uid(102), { ...fixture(2).snapshot, payloadDigest: '0'.repeat(64) });
  const value = await store(); await expect(run(value)).rejects.toThrow('identity');
  expect(await value.cursor(did)).toBe(0); expect(await value.list(did)).toEqual([]);
  snapshots.set(uid(102), fixture(2).snapshot); await run(value); expect(await value.list(did)).toHaveLength(2);
});
it('a changed source keeps its transfer identity and retains the old snapshot', async () => {
  const original = fixture(1); receive(original); const value = await store(); await run(value);
  const newer = fixture(2); newer.record.transferId = original.record.transferId; newer.record.sourceRecordId = original.record.sourceRecordId;
  records = [newer.record]; snapshots.set(newer.snapshot.snapshotId, newer.snapshot);
  await run(value); expect(await value.list(did)).toHaveLength(1);
  expect((await value.list(did))[0].snapshotId).toBe(newer.record.snapshotId);
  expect(await value.snapshot(did, original.snapshot.snapshotId)).toEqual(original.snapshot);
});
it('account switching rejects stale responses and advances no cursor', async () => {
  receive(fixture()); const value = await store();
  beforeResponse = () => { current = { ...current, generation: 2, account: { did: 'did:plc:other', handle: 'other.test' } }; };
  await expect(run(value)).rejects.toThrow(); expect(await value.cursor(did)).toBe(0); expect(await value.list(did)).toEqual([]);
});
it('sign-out during a page transaction rolls back snapshots, mappings and cursor', async () => {
  const value = await store(); const original = database.db.runAsync;
  let live = true;
  database.db.runAsync = async (...args) => { const result = await original(...args); live = false; return result; };
  const f = fixture(); await expect(value.applyPage(did, 0, [f.record], 1, [f.snapshot], () => live)).rejects.toThrow('Account changed');
  expect(await value.cursor(did)).toBe(0); expect(await value.snapshot(did, f.snapshot.snapshotId)).toBeNull();
});
it('rejects payload tampering even when the advertised digest and IDs match', async () => {
  const f = fixture(); const wrong = { ...f.snapshot, payloadBytesBase64: Buffer.from('{}').toString('base64') };
  await expect(verifySnapshot(wrong, f.record)).rejects.toThrow('integrity');
});
it('retains unknown encodings opaquely and does not promote them to a chart', async () => {
  const f = fixture(); f.record.payloadEncoding = 'future-format'; f.snapshot.payloadEncoding = 'future-format'; receive(f);
  const value = await store(); await run(value);
  expect((await value.list(did))[0].name).toBe('Transferred chart');
  expect(await value.snapshot(did, f.snapshot.snapshotId)).toEqual(f.snapshot);
});
it('rejects invalid and out-of-order archive feeds before storing a cursor', async () => {
  receive(fixture(2)); receive(fixture(1)); const value = await store();
  await expect(run(value)).rejects.toThrow('Out-of-order'); expect(await value.cursor(did)).toBe(0);
});
it('archive and ordinary chart cursors are independent', async () => {
  await database.db.execAsync('CREATE TABLE library_accounts(owner TEXT PRIMARY KEY,cursor INTEGER)');
  await database.db.runAsync('INSERT INTO library_accounts(owner,cursor) VALUES(?,?)', did, 99);
  receive(fixture()); const value = await store(); await run(value);
  expect(await value.cursor(did)).toBe(1);
  expect(await database.db.getFirstAsync('SELECT cursor FROM library_accounts WHERE owner=?', did)).toEqual({ cursor: 99 });
});
it('cannot open unsupported, deleted, unconverted or invalid destination charts', () => {
  const row = { ...fixture().record, name: 'Fixture', destinationChartId: 'existing-expo-id' };
  const saved = [{ id: 'existing-expo-id', name: 'Destination', datetime: '2000-01-01T00:00:00Z', settings: DEFAULT_SETTINGS }];
  expect(archiveDestination(row, saved)).toBeNull();
  row.compatibility = { ...row.compatibility, state: 'ready' }; expect(archiveDestination(row, saved)).toBe('existing-expo-id');
  expect(archiveDestination(row, [{ ...saved[0], datetime: '1800-01-01T00:00:00Z' }])).toBeNull();
  expect(archiveDestination(row, [])).toBeNull();
  expect(archiveDestination({ ...row, tombstone: true }, saved)).toBeNull();
});
it('empty libraries complete retrieval with a zero cursor', async () => {
  const value = await store(); await run(value); expect(await value.cursor(did)).toBe(0); expect(await value.list(did)).toEqual([]);
});

it('retrieves exact Swift-generated snapshots with their raw sources and independent IDs', async () => {
  const packet = jest.requireActual<{ operations: { sourceNamespace: string; sourceRecordId: string; payloadBytesBase64: string; payloadDigest: string; payloadEncoding: string }[] }>('./fixtures/swift-transfer-v1.json');
  packet.operations.forEach((operation, index) => {
    const f = fixture(index + 1);
    Object.assign(f.record, { sourceNamespace: operation.sourceNamespace, sourceRecordId: operation.sourceRecordId, payloadDigest: operation.payloadDigest, payloadEncoding: operation.payloadEncoding });
    Object.assign(f.snapshot, { payloadBytesBase64: operation.payloadBytesBase64, payloadDigest: operation.payloadDigest, payloadEncoding: operation.payloadEncoding });
    receive(f);
  });
  const value = await store(); await run(value);
  const charts = await value.list(did);
  expect(charts).toHaveLength(2);
  expect(new Set(charts.map(chart => chart.sourceRecordId)).size).toBe(2);
  expect(charts.map(chart => chart.name)).toEqual(['Synthetic transfer fixture 1', 'Synthetic transfer fixture 2']);
  expect(await value.cursor(did)).toBe(4);
  for (let index = 0; index < packet.operations.length; index++) {
    expect((await value.snapshot(did, uid(index + 101)))?.payloadBytesBase64).toBe(packet.operations[index].payloadBytesBase64);
  }
});
