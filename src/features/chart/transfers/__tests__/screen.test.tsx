import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Text, TextInput } from 'react-native';
import ChartExceptionsScreen from '@/app/chart-transfers';
import { CONVERSION_PROFILE, type ConversionPreview } from '../conversion';
import type { ArchivedChart } from '../types';
const mockRouter = { push: jest.fn() };
const mockAccount = { scope: 'did:plc:a', records: [{ transferId: 'bad', snapshotId: 'bad', name: 'Old sidereal' }, { transferId: 'good', snapshotId: 'good', name: 'Imported chart' }] as ArchivedChart[], previews: [] as ConversionPreview[], downloading: false, error: null as string | null, refresh: jest.fn() };
jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('../ArchiveContext', () => ({ useChartArchive: () => mockAccount }));
let view: ReactTestRenderer;
const preview = (id: string, state: ConversionPreview['state'], reasons: string[] = []): ConversionPreview => ({ transferId: id, snapshotId: id, profileVersion: CONVERSION_PROFILE, state, reasons, chart: null, destinationChartId: null, record: null });
const text = () => view.root.findAllByType(Text).map(n => n.props.children).flat().join(' ');
beforeEach(() => {
  jest.clearAllMocks(); mockAccount.downloading = false; mockAccount.error = null;
  mockAccount.previews = [preview('bad', 'unsupported', ['sidereal_or_unknown_zodiac']), preview('good', 'already_added')];
  act(() => { view = create(<ChartExceptionsScreen />); });
});
afterEach(() => act(() => view.unmount()));
it('shows exceptions only, with precise reasons and no migration actions', () => {
  expect(text()).toContain('Old sidereal'); expect(text()).toContain('zodiac system');
  expect(text()).not.toContain('Imported chart');
  expect(text()).not.toMatch(/Review all|Confirm and add|Check compatibility/);
  expect(text()).toContain('automatically');
});
it('filters exceptions without changing the library and distinguishes a download failure', () => {
  act(() => view.root.findByType(TextInput).props.onChangeText('no match'));
  expect(text()).toContain('No exceptions match');
  mockAccount.error = 'Couldn’t load all your account charts.';
  act(() => view.update(<ChartExceptionsScreen />));
  expect(text()).toContain('Retry loading charts');
  expect(text()).not.toContain('No exceptions match');
});
it('does not treat intentional deletion as a compatibility problem and keeps changed copies explained', () => {
  mockAccount.previews = [preview('good', 'deleted'), preview('bad', 'source_changed')];
  act(() => view.update(<ChartExceptionsScreen />));
  expect(text()).not.toContain('Imported chart'); expect(text()).toContain('saved copy has been kept unchanged');
});

it('ignores an assessment for an older source snapshot', () => {
  mockAccount.previews = [preview('bad', 'unsupported', ['date_range'])];
  mockAccount.records = [{ transferId: 'bad', snapshotId: 'new', name: 'Changed original' }] as ArchivedChart[];
  act(() => view.update(<ChartExceptionsScreen />));
  expect(text()).toContain('No chart exceptions'); expect(text()).not.toContain('Changed original');
  mockAccount.records = [{ transferId: 'bad', snapshotId: 'bad', name: 'Old sidereal' }, { transferId: 'good', snapshotId: 'good', name: 'Imported chart' }] as ArchivedChart[];
});
