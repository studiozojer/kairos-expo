import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Text, TextInput } from 'react-native';
import ChartTransfersScreen from '@/app/chart-transfers';
import { ReplacementChooser } from '../../active/ReplacementChooser';
import { DEFAULT_SETTINGS, LEGACY_CALCULATION } from '../../settings/chartSettings';
import { CONVERSION_PROFILE, type ConversionPreview } from '../conversion';
import type { ArchivedChart } from '../types';
import { TransferReviewSheet } from '../TransferReviewSheet';
const mockConversions = { previews: [] as ConversionPreview[], busy: false, error: null, progress: null, check: jest.fn(), add: jest.fn() };
jest.mock('../useConversions', () => ({ useConversions: () => mockConversions }));
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
beforeEach(() => { jest.clearAllMocks(); mockConversions.previews = []; mockArchive.records = [row('unsupported'), row('needs_review'), row('ready')]; mockActive.openSaved.mockReturnValue(true); act(() => { view = create(<ChartTransfersScreen />); }); });
afterEach(() => act(() => view.unmount()));
const openButtons = () => view.root.findAll(node => typeof node.props.accessibilityLabel === 'string' && node.props.accessibilityLabel.startsWith('Open ') && typeof node.props.onPress === 'function');
it('lists received records and opening support separately, with no open button for unsupported records', () => {
  expect(view.root.findAllByType(Text).map(node => node.props.children).flat().join(' ')).toContain('Not checked');
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

const text = () => view.root.findAllByType(Text).map(node => node.props.children).flat().join(' ');
const button = (label: string) => view.root.findAll(node => node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function')
  .find(node => node.props.accessibilityLabel === label || node.findAllByType(Text).some(text => [text.props.children].flat().join('') === label))!;
function proposal(id = 'needs_review', reasons = ['confirm_ordinary_chart', 'confirm_captured_settings']): ConversionPreview {
  return { transferId: id, snapshotId: id, profileVersion: CONVERSION_PROFILE, state: 'needs_review', reasons,
    chart: { ...mockActive.saved[0], settings: { ...DEFAULT_SETTINGS, ...LEGACY_CALCULATION, lunarNodeType: 'True' } }, destinationChartId: null, record: null };
}
it('uses the latest assessment for rows and counts without repeated explanation paragraphs', () => {
  mockConversions.previews = [proposal('unsupported')];
  act(() => view.update(<ChartTransfersScreen />));
  expect(text()).toContain('1 needs confirmation');
  expect(text()).not.toContain('No saved source setting');
  act(() => button('Details for unsupported').props.onPress());
  expect(text()).toContain('No saved source setting');
});
it('requires explicit review, shows counted decisions and actual settings, and cancels without adding', () => {
  const first = proposal();
  const second = proposal('unsupported', ['confirm_ordinary_chart', 'confirm_captured_settings', 'confirm_tropical_zodiac']);
  mockConversions.previews = [first, second];
  act(() => view.update(<ChartTransfersScreen />));
  expect(mockConversions.check).not.toHaveBeenCalled(); expect(mockConversions.add).not.toHaveBeenCalled();
  act(() => button('Review all 2 charts').props.onPress());
  expect(text()).toContain('True Node'); expect(text()).toContain('Mean Lilith');
  expect(text()).toContain('All 2 charts'); expect(text()).toContain('1 of 2 charts');
  expect(mockConversions.add).not.toHaveBeenCalled();
  act(() => button('View charts: confirm_tropical_zodiac').props.onPress());
  expect(view.root.findByType(TransferReviewSheet).props.selection).toEqual([first, second]);
  const sheetText = view.root.findByType(TransferReviewSheet).findAllByType(Text).map(node => node.props.children).flat().join(' ');
  expect(sheetText).toContain('unsupported');
  expect(sheetText).not.toContain('needs_review');
  act(() => button('Cancel').props.onPress());
  expect(mockConversions.add).not.toHaveBeenCalled();
  expect(view.root.findAllByType(TransferReviewSheet)).toHaveLength(0);
  act(() => button('Review all 2 charts').props.onPress());
  act(() => button('Confirm and add 2 charts').props.onPress());
  expect(mockConversions.add).toHaveBeenCalledWith([first, second], true);
});
it('makes full-library scope explicit even under search and excludes unsupported records', () => {
  const first = proposal(), second = proposal('unsupported');
  mockConversions.previews = [first, second, { ...proposal('ready'), state: 'unsupported', chart: null }];
  act(() => view.update(<ChartTransfersScreen />));
  act(() => view.root.findByType(TextInput).props.onChangeText('no matching charts'));
  expect(text()).toContain('Search filters the list only');
  act(() => button('Review all 2 charts').props.onPress());
  act(() => button('Confirm and add 2 charts').props.onPress());
  expect(mockConversions.add).toHaveBeenCalledWith([first, second], true);
});
it('invalidates a review when a snapshot or assessment changes instead of silently submitting a new batch', () => {
  mockConversions.previews = [proposal()];
  act(() => view.update(<ChartTransfersScreen />));
  act(() => button('Review all 1 chart').props.onPress());
  mockConversions.previews = [proposal('needs_review', ['confirm_millisecond_precision'])];
  act(() => view.update(<ChartTransfersScreen />));
  expect(button('Confirm and add 1 chart').props.disabled).toBe(true);
  act(() => view.root.findByType(TransferReviewSheet).props.onConfirm());
  expect(mockConversions.add).not.toHaveBeenCalled();
  expect(text()).toContain('assessment changed');
});
it('offers the Saved Charts handoff and does not label deleted copies added', () => {
  mockConversions.previews = [{ ...proposal('ready'), state: 'deleted', chart: null }];
  act(() => view.update(<ChartTransfersScreen />));
  expect(text()).toContain('Saved copy deleted');
  expect(openButtons()).toHaveLength(0);
  expect(text()).not.toContain('View Saved Charts');
  mockConversions.previews = [{ ...proposal('ready'), state: 'already_added', chart: null }];
  act(() => view.update(<ChartTransfersScreen />));
  act(() => button('View Saved Charts').props.onPress());
  expect(mockRouter.push).toHaveBeenCalledWith('/charts');
});

it('lets a fully compatible batch inspect its chart names and import without acknowledging absent-input choices', () => {
  const compatible = { ...proposal('needs_review', []), state: 'compatible' as const };
  mockConversions.previews = [compatible];
  act(() => view.update(<ChartTransfersScreen />));
  act(() => button('Review all 1 chart').props.onPress());
  act(() => button('View charts: Tropical · True Node · Mean Lilith · Traditional lots').props.onPress());
  expect(view.root.findByType(TransferReviewSheet).findAllByType(Text).map(n => n.props.children).flat().join(' ')).toContain('needs_review');
  act(() => button('Confirm and add 1 chart').props.onPress());
  expect(mockConversions.add).toHaveBeenCalledWith([compatible], false);
});
it('does not reuse a review after account switching', () => {
  mockConversions.previews = [proposal()];
  act(() => view.update(<ChartTransfersScreen />));
  act(() => button('Review all 1 chart').props.onPress());
  mockArchive.scope = 'did:plc:other';
  act(() => view.update(<ChartTransfersScreen />));
  expect(button('Confirm and add 1 chart').props.disabled).toBe(true);
  act(() => view.root.findByType(TransferReviewSheet).props.onConfirm());
  expect(mockConversions.add).not.toHaveBeenCalled();
  mockArchive.scope = 'did:plc:a';
});
