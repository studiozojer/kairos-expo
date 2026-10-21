import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
import { Stack } from 'expo-router';
import SearchScreen from '../SearchScreen';
import { ReplacementChooser } from '../../chart/active/ReplacementChooser';
import { DEFAULT_SETTINGS } from '../../chart/settings/chartSettings';
import type { SavedChart } from '../../chart/active/model';
const mockRouter = { navigate: jest.fn() };
const chart: SavedChart = { id: 'a', name: 'Alice', datetime: '2000-06-10T00:00:00Z', settings: DEFAULT_SETTINGS };
const mockState = {
  scope: null as string | null, loaded: true, saved: [chart], active: [] as any[], loadError: false, libraryError: null,
  libraryPreferences: { opened: {} }, openSaved: jest.fn(), reloadLibrary: jest.fn(), retryLoad: jest.fn(),
};
const mockAccount = { initialLoading: false, downloading: false, error: null, refresh: jest.fn() };
jest.mock('expo-router', () => ({ Stack: { Screen: () => null }, useRouter: () => mockRouter }));
jest.mock('../../chart/active/ActiveChartsContext', () => ({ useActiveCharts: () => mockState }));
jest.mock('../../chart/transfers/ArchiveContext', () => ({ useAccountCharts: () => mockAccount }));
let view: ReactTestRenderer;
const press = async (label: string) => act(() => view.root.findAll(n => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')[0].props.onPress());
const text = () => view.root.findAllByType(Text).map(n => n.props.children).flat().join(' ');
beforeEach(async () => {
  jest.clearAllMocks(); mockState.scope = null; mockState.saved = [chart]; mockState.active = []; mockState.loadError = false;
  mockState.loaded = true; mockAccount.initialLoading = false; mockState.openSaved.mockReturnValue(true);
  await act(async () => { view = create(<SearchScreen />); });
});
afterEach(() => act(() => view.unmount()));
test('native search filters, cancellation restores browse, and selection opens the saved chart', async () => {
  const options = () => view.root.findByType(Stack.Screen).props.options.headerSearchBarOptions;
  await act(async () => options().onChangeText({ nativeEvent: { text: 'missing' } }));
  expect(text()).toContain('No results for');
  await act(async () => options().onCancelButtonPress());
  await press('Open Alice');
  expect(mockState.openSaved).toHaveBeenCalledWith('a', undefined);
  expect(mockRouter.navigate).toHaveBeenCalledWith('/(tabs)/(chart)');
});
test('full slots prompt for replacement; a chart deleted during the prompt cannot open', async () => {
  mockState.active = ['one', 'two', 'three'].map(id => ({ id, name: id, time: Date.parse(chart.datetime), settings: DEFAULT_SETTINGS })); mockState.openSaved.mockReturnValue(false);
  await act(async () => view.update(<SearchScreen />));
  await press('Open Alice');
  expect(view.root.findByType(ReplacementChooser).props.visible).toBe(true);
  mockState.saved = [];
  await act(async () => view.update(<SearchScreen />));
  act(() => view.root.findByType(ReplacementChooser).props.onSelect('one'));
  expect(mockState.openSaved).toHaveBeenCalledTimes(1);
  expect(mockRouter.navigate).not.toHaveBeenCalled();
  expect(text()).toContain('This chart is no longer saved.');
});
test('account switch clears pending actions and queries', async () => {
  mockState.active = ['one', 'two', 'three'].map(id => ({ id, name: id, time: Date.parse(chart.datetime), settings: DEFAULT_SETTINGS })); mockState.openSaved.mockReturnValue(false);
  await press('Open Alice');
  mockState.scope = 'other'; mockState.saved = [];
  await act(async () => view.update(<SearchScreen />));
  expect(view.root.findByType(ReplacementChooser).props.visible).toBe(false);
  expect(text()).not.toContain('Alice');
});
test('loading and storage failure are not presented as an empty library', async () => {
  mockState.saved = []; mockAccount.initialLoading = true;
  await act(async () => view.update(<SearchScreen />));
  expect(text()).not.toContain('No saved charts yet');
  mockAccount.initialLoading = false; mockState.loaded = false; mockState.loadError = true;
  await act(async () => view.update(<SearchScreen />));
  expect(text()).toContain('Could not load saved charts.');
  expect(text()).not.toContain('No saved charts yet');
});
