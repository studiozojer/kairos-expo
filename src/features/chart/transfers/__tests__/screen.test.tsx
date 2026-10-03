import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Text, TextInput } from 'react-native';
import ChartTransfersScreen from '@/app/chart-transfers';
import { ReplacementChooser } from '../../active/ReplacementChooser';
import { DEFAULT_SETTINGS } from '../../settings/chartSettings';
import type { ArchivedChart } from '../types';
const mockRouter = { push: jest.fn(), back: jest.fn(), dismissTo: jest.fn() };
const mockArchive = { scope: 'did:plc:a', records: [] as ArchivedChart[], downloading: false, error: null, refresh: jest.fn() };
const mockActive = { scope: 'did:plc:a', saved: [{ id: 'destination', name: 'Ready', datetime: '2000-01-01T00:00:00Z', settings: DEFAULT_SETTINGS }], active: [], openSaved: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('../ArchiveContext', () => ({ useChartArchive: () => mockArchive }));
jest.mock('../../active/ActiveChartsContext', () => ({ useActiveCharts: () => mockActive }));
function row(state: ArchivedChart['compatibility']['state']): ArchivedChart {
  return { transferId: state, name: state, sourceNamespace: 'fixture', sourceRecordId: state, snapshotId: state, payloadDigest: '', payloadEncoding: 'fixture', revision: 1, receivedAt: '', compatibility: { state, reasons: [], classifierVersion: 'fixture' }, destinationChartId: 'destination', parentSourceRecordId: null, parentTransferId: null, tombstone: false };
}
let view: ReactTestRenderer;
beforeEach(() => { jest.clearAllMocks(); mockArchive.records = [row('unsupported'), row('needs_review'), row('ready')]; mockActive.openSaved.mockReturnValue(true); act(() => { view = create(<ChartTransfersScreen />); }); });
afterEach(() => act(() => view.unmount()));
const openButtons = () => view.root.findAll(node => typeof node.props.accessibilityLabel === 'string' && node.props.accessibilityLabel.startsWith('Open ') && typeof node.props.onPress === 'function');
it('lists received records and opening support separately, with no open button for unsupported records', () => {
  expect(view.root.findAllByType(Text).map(node => node.props.children).flat().join(' ')).toContain('Opening support not available yet');
  expect(openButtons()).toHaveLength(1);
  act(() => view.root.findByType(TextInput).props.onChangeText('unsupported'));
  expect(openButtons()).toHaveLength(0); expect(mockActive.openSaved).not.toHaveBeenCalled();
});
it('opens only an existing ready destination and follows ordinary chart replacement', () => {
  mockActive.openSaved.mockReturnValueOnce(false);
  act(() => openButtons()[0].props.onPress());
  expect(mockRouter.dismissTo).not.toHaveBeenCalled();
  expect(view.root.findByType(ReplacementChooser).props.visible).toBe(true);
  act(() => view.root.findByType(ReplacementChooser).props.onSelect('existing-instance'));
  expect(mockActive.openSaved).toHaveBeenLastCalledWith('destination', 'existing-instance');
  expect(mockRouter.dismissTo).toHaveBeenCalledWith('/(tabs)/(chart)');
});
it('rechecks compatibility after a pending open before changing the wheel', () => {
  mockActive.openSaved.mockReturnValueOnce(false);
  act(() => openButtons()[0].props.onPress());
  mockArchive.records = mockArchive.records.map(record => record.compatibility.state === 'ready' ? { ...record, compatibility: { ...record.compatibility, state: 'unsupported' } } : record);
  act(() => view.update(<ChartTransfersScreen />));
  act(() => view.root.findByType(ReplacementChooser).props.onSelect('existing-instance'));
  expect(mockActive.openSaved).toHaveBeenCalledTimes(1); expect(mockRouter.dismissTo).not.toHaveBeenCalled();
});
