import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
import { ArchiveProvider, useChartArchive } from '../ArchiveContext';
import { captureSession, isCurrentSession } from '@/auth/session';
import { downloadAccountCharts } from '../../library/sync';
import { retrieveArchive } from '../sync';
import { importAccountArchive } from '../conversion';
const mockAuth = { ready: true, account: { did: 'did:plc:a' } };
const mockReloadWithSync = jest.fn();
let mockReload = jest.fn().mockResolvedValue(undefined);
const mockStore = { list: jest.fn().mockResolvedValue([]) };
jest.mock('@/auth/auth-context', () => ({ useAuth: () => mockAuth }));
jest.mock('@/auth/session', () => ({ captureSession: jest.fn(), isCurrentSession: jest.fn(), subscribeSession: () => () => {} }));
jest.mock('../store', () => ({ getChartArchive: async () => mockStore }));
jest.mock('../../library/store', () => ({ getChartLibrary: async () => ({}) }));
jest.mock('../../library/sync', () => ({ downloadAccountCharts: jest.fn() }));
jest.mock('../sync', () => ({ retrieveArchive: jest.fn() }));
jest.mock('../conversion', () => ({ importAccountArchive: jest.fn() }));
jest.mock('../../active/ActiveChartsContext', () => ({ useActiveCharts: () => ({ refreshLibrary: mockReload, reloadLibrary: mockReloadWithSync }) }));
function Probe() {
  const state = useChartArchive();
  return <><Text>{state.scope}</Text><Text>{state.initialLoading ? 'initial-loading' : 'settled'}</Text><Text>{state.error}</Text><Text>{state.previews.map(p => p.transferId).join(',')}</Text><Text onPress={() => void state.refresh()}>retry</Text></>;
}
let view: ReactTestRenderer;
beforeEach(() => {
  jest.clearAllMocks(); mockStore.list.mockResolvedValue([]); mockAuth.account = { did: 'did:plc:a' };
  jest.mocked(captureSession).mockImplementation(async () => ({ account: mockAuth.account, token: 'fixture', generation: 1 }) as any);
  jest.mocked(isCurrentSession).mockReturnValue(true);
  jest.mocked(downloadAccountCharts).mockResolvedValue(undefined);
  jest.mocked(retrieveArchive).mockResolvedValue(undefined);
  jest.mocked(importAccountArchive).mockResolvedValue([]);
});
afterEach(() => act(() => view.unmount()));
it('starts account download and archive import on sign-in without any migration action', async () => {
  await act(async () => { view = create(<ArchiveProvider><Probe /></ArchiveProvider>); });
  expect(downloadAccountCharts).toHaveBeenCalledTimes(1); expect(importAccountArchive).toHaveBeenCalledTimes(1);
  expect(view.root.findAllByType(Text).map(n => n.props.children)).toContain('settled');
});
it('keeps failure visible and resumes loading on retry', async () => {
  jest.mocked(downloadAccountCharts).mockRejectedValueOnce(new Error('offline'));
  await act(async () => { view = create(<ArchiveProvider><Probe /></ArchiveProvider>); });
  expect(importAccountArchive).not.toHaveBeenCalled();
  expect(view.root.findAllByType(Text).map(n => n.props.children).join(' ')).toContain('Downloaded charts remain available');
  await act(async () => { view.root.findAllByType(Text).find(n => n.props.children === 'retry')!.props.onPress(); });
  expect(importAccountArchive).toHaveBeenCalledTimes(1);
});
it('aborts the prior account before continuing archive work after an account switch', async () => {
  let finish!: () => void;
  jest.mocked(downloadAccountCharts).mockImplementationOnce(async (_store, _session, signal) => {
    await new Promise<void>(resolve => { finish = resolve; });
    if (signal.aborted) throw new Error('stopped');
  });
  await act(async () => { view = create(<ArchiveProvider><Probe /></ArchiveProvider>); });
  mockAuth.account = { did: 'did:plc:b' };
  await act(async () => { view.update(<ArchiveProvider><Probe /></ArchiveProvider>); });
  await act(async () => finish());
  expect(importAccountArchive).toHaveBeenCalledTimes(1);
  expect(jest.mocked(importAccountArchive).mock.calls[0][1].account.did).toBe('did:plc:b');
});

it('does not restart retrieval when the library callback changes or time passes', async () => {
  jest.useFakeTimers();
  try {
    await act(async () => { view = create(<ArchiveProvider><Probe /></ArchiveProvider>); });
    mockReload = jest.fn().mockResolvedValue(undefined);
    await act(async () => { view.update(<ArchiveProvider><Probe /></ArchiveProvider>); });
    await act(async () => { jest.advanceTimersByTime(180000); });
    expect(downloadAccountCharts).toHaveBeenCalledTimes(1);
  } finally { jest.useRealTimers(); }
});
it('keeps existing exceptions visible while a new assessment is pending', async () => {
  const exception = { transferId: 'exception', snapshotId: 'snapshot', state: 'unsupported', reasons: ['sidereal'], chart: null, destinationChartId: null, record: null } as any;
  mockStore.list.mockResolvedValue([{ transferId: 'exception', snapshotId: 'snapshot' }]);
  jest.mocked(importAccountArchive).mockImplementationOnce(async (_records, _session, _signal, _library, _changed, assessed) => { assessed([exception]); return [exception]; });
  await act(async () => { view = create(<ArchiveProvider><Probe /></ArchiveProvider>); });
  let finish!: () => void;
  jest.mocked(importAccountArchive).mockImplementationOnce(async (_records, _session, _signal, _library, _changed, assessed) => {
    assessed([]);
    await new Promise<void>(resolve => { finish = resolve; });
    return [];
  });
  await act(async () => { view.root.findAllByType(Text).find(n => n.props.children === 'retry')!.props.onPress(); });
  expect(view.root.findAllByType(Text).map(n => n.props.children)).toContain('exception');
  await act(async () => finish());
  expect(view.root.findAllByType(Text).map(n => n.props.children)).not.toContain('exception');
});

it('publishes incoming pages through local refresh without starting edit sync', async () => {
  jest.mocked(downloadAccountCharts).mockImplementationOnce(async (_store, _session, _signal, changed) => { await changed!(); });
  jest.mocked(importAccountArchive).mockImplementationOnce(async (_records, _session, _signal, _library, changed) => {
    for (let page = 0; page < 3; page++) await changed();
    return [];
  });
  await act(async () => { view = create(<ArchiveProvider><Probe /></ArchiveProvider>); });
  expect(mockReload).toHaveBeenCalledTimes(4);
  expect(mockReloadWithSync).not.toHaveBeenCalled();
});
