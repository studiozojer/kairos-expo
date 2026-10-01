import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ActivityIndicator, Alert, FlatList, TextInput } from 'react-native';
import { MenuView } from '@react-native-menu/menu';
import SavedChartsScreen from '@/app/charts';
import { LibraryRow } from '../LibraryRow';
import { ReplacementChooser } from '../../active/ReplacementChooser';
import { DEFAULT_SETTINGS } from '../../settings/chartSettings';
import type { SavedChart } from '../../active/model';
const mockRouter = { push: jest.fn(), back: jest.fn(), dismissTo: jest.fn() };
const mockState = {
  scope: null, loaded: true, saved: [] as SavedChart[], active: [] as any[], loadError: false, saveError: false, libraryError: null,
  libraryPreferences: { sort: 'recent', opened: {} }, syncing: false, syncState: null,
  openSaved: jest.fn(), addNow: jest.fn(), setFavorite: jest.fn().mockResolvedValue(undefined), setLibrarySort: jest.fn().mockResolvedValue(undefined), deleteSaved: jest.fn(),
};
jest.mock('expo-router', () => ({ Stack: { Screen: () => null }, useRouter: () => mockRouter }));
jest.mock('../../active/ActiveChartsContext', () => ({ useActiveCharts: () => mockState }));
jest.mock('../LibrarySyncSettings', () => ({ LibrarySyncSettings: () => null }));
let view: ReactTestRenderer;
const press = (label: string) => act(() => view.root.findAll(node => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0].props.onPress());
const chart = (id: string, name: string, tag?: string): SavedChart => ({ id, name, datetime: '2000-01-01T12:00:00Z', settings: DEFAULT_SETTINGS, metadata: { favorite: false, tags: tag ? [{ id: tag, name: tag }] : [] } });
beforeEach(() => { jest.clearAllMocks(); mockState.loaded = true; mockState.syncing = false; mockState.saved = [chart('a', 'Alice', 'Family'), chart('b', 'Bob', 'Work')]; mockState.openSaved.mockReturnValue(true); act(() => { view = create(<SavedChartsScreen />); }); });
afterEach(() => act(() => view.unmount()));
test('search intersects tags and cancels without losing tag selection', () => {
  press('Filter: Family');
  expect(view.root.findAllByType(LibraryRow).map(row => row.props.chart.id)).toEqual(['a']);
  press('Search charts');
  act(() => view.root.findByType(TextInput).props.onChangeText('Bob'));
  expect(view.root.findAllByType(LibraryRow)).toHaveLength(0);
  press('Cancel chart search');
  expect(view.root.findAllByType(LibraryRow).map(row => row.props.chart.id)).toEqual(['a']);
});
test('selection dismisses only after replacement completes; cancellation does not open', () => {
  mockState.openSaved.mockReturnValueOnce(false);
  press('Open Alice');
  expect(mockRouter.dismissTo).not.toHaveBeenCalled();
  expect(view.root.findByType(ReplacementChooser).props.visible).toBe(true);
  act(() => view.root.findByType(ReplacementChooser).props.onCancel());
  expect(mockState.openSaved).toHaveBeenCalledTimes(1);
  press('Open Alice');
  expect(mockRouter.dismissTo).toHaveBeenCalledWith('/(tabs)/(chart)');
});
test('menus route duplicate/edit with library return context and require delete confirmation', () => {
  const row = view.root.findAllByType(LibraryRow)[0];
  act(() => row.props.onAction('duplicate'));
  expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/chart-editor', params: { duplicate: 'a', fromLibrary: '1' } });
  act(() => row.props.onAction('edit'));
  expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/chart-editor', params: { id: 'a', fromLibrary: '1' } });
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  act(() => row.props.onAction('delete'));
  expect(mockState.deleteSaved).not.toHaveBeenCalled();
  act(() => alert.mock.calls[0][2]![1].onPress!());
  expect(mockState.deleteSaved).toHaveBeenCalledWith('a');
  alert.mockRestore();
});
test('favorite and sort controls call persistence; empty library still offers Now', async () => {
  await act(async () => view.root.findAllByType(LibraryRow)[0].props.onAction('favorite'));
  expect(mockState.setFavorite).toHaveBeenCalledWith('a', true);
  await act(async () => view.root.findAllByType(MenuView).find(menu => menu.props.title === 'Sort charts')!.props.onPressAction({ nativeEvent: { event: 'name-desc' } }));
  expect(mockState.setLibrarySort).toHaveBeenCalledWith('name-desc');
  mockState.saved = [];
  act(() => view.update(<SavedChartsScreen />));
  press('Open a Now chart');
  expect(mockState.addNow).toHaveBeenCalled();
});

test('background sync keeps cached rows visible without a sheet-level refresh spinner', () => {
  mockState.syncing = true;
  act(() => view.update(<SavedChartsScreen />));
  expect(view.root.findAllByType(LibraryRow)).toHaveLength(2);
  expect(view.root.findAllByType(ActivityIndicator)).toHaveLength(0);
  expect(view.root.findByType(FlatList).props.refreshing).toBeUndefined();
  expect(view.root.findByType(FlatList).props.onRefresh).toBeUndefined();
});
test('initial loading belongs to the list status row below the sticky header', () => {
  mockState.loaded = false;
  act(() => view.update(<SavedChartsScreen />));
  const list = view.root.findByType(FlatList);
  expect(list.props.data).toEqual([{ type: 'status' }]);
  expect(list.props.stickyHeaderIndices).toEqual([0]);
  expect(view.root.findByType(ActivityIndicator).props.accessibilityLabel).toBe('Loading charts');
  expect(view.root.findAllByType(LibraryRow)).toHaveLength(0);
});
