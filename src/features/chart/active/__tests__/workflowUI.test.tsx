import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Modal, TextInput } from 'react-native';
import { MenuView } from '@react-native-menu/menu';
import ChartEditorScreen from '@/app/chart-editor';
import SavedChartsScreen from '@/app/charts';
import { ActiveChartCards } from '../ActiveChartCards';
import { Action } from '../../display/controls';
import { DEFAULT_SETTINGS } from '../../settings/chartSettings';

let mockParams: { id?: string } = {};
const mockRouter = { push: jest.fn(), dismissTo: jest.fn() };
const mockState = {
  loaded: true, loadError: false, saveError: false, saving: false,
  saved: [] as any[], active: [] as any[], targetId: 'a', calculations: {},
  saveChart: jest.fn(), openSaved: jest.fn(), addNow: jest.fn(), remove: jest.fn(), move: jest.fn(), moveTo: jest.fn(),
  selectTarget: jest.fn(), reset: jest.fn(), retryLoad: jest.fn(), retryPersistence: jest.fn(),
};
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => mockParams, Stack: { Screen: () => null } }));
jest.mock('../ActiveChartsContext', () => ({ useActiveCharts: () => mockState }));
jest.mock('../../settings/atlas', () => ({ searchAtlas: jest.fn().mockResolvedValue([]) }));
jest.mock('react-native-gesture-handler', () => ({
  ...jest.requireActual('react-native-gesture-handler'),
  // This file checks UI actions; cardSlots.test drives the real gesture callbacks.
  GestureDetector: ({ children }: { children: unknown }) => children,
}));
jest.mock('react-native-reanimated', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    default: { View: jest.requireActual('react-native').View, createAnimatedComponent: (component: unknown) => component }, __esModule: true,
    useSharedValue: (initial: unknown) => React.useRef({ value: initial }).current,
    useAnimatedStyle: (calculate: () => unknown) => calculate(),
    runOnJS: (fn: unknown) => fn, cancelAnimation: () => {}, withSpring: (value: number) => value,
  };
});
let view: ReactTestRenderer;
const action = (label: string) => view.root.findAllByType(Action).find(node => node.props.label === label)!;
const field = (label: string, value: string) => act(() => view.root.findAllByType(TextInput).find(node => node.props.accessibilityLabel === label)!.props.onChangeText(value));
const button = (label: string) => view.root.findAll(node => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
const instance = (id: string) => ({ id, name: 'Natal', kind: 'saved', origin: Date.parse('1990-07-05T21:30:00Z'), time: Date.parse('1990-07-05T21:30:00Z'), settings: DEFAULT_SETTINGS, unit: 2 });
beforeEach(() => {
  jest.clearAllMocks(); mockParams = {}; mockState.loaded = true; mockState.loadError = false; mockState.active = []; mockState.saved = []; mockState.targetId = 'a';
  mockState.saveChart.mockImplementation(draft => ({ ...draft, id: 'saved-1' })); mockState.openSaved.mockReturnValue(true);
});
afterEach(() => { if (view) act(() => view.unmount()); });

test('create validates input and saves the chosen local time as UTC before opening', () => {
  act(() => { view = create(<ChartEditorScreen />); });
  act(() => action('Save and open').props.onPress());
  expect(mockState.saveChart).not.toHaveBeenCalled();
  field('Chart name', 'Natal'); field('Date · YYYY-MM-DD', '1990-07-05'); field('Time · HH:mm:ss (24-hour)', '14:30');
  act(() => action('Save and open').props.onPress());
  expect(mockState.saveChart).toHaveBeenCalledWith({ name: 'Natal', datetime: '1990-07-05T21:30:00.000Z', settings: DEFAULT_SETTINGS }, undefined);
  expect(mockState.openSaved).toHaveBeenCalledWith('saved-1', undefined);
  expect(mockRouter.dismissTo).toHaveBeenCalledWith('/(tabs)/(chart)');
});
test('ambiguous local time requires explicit occurrence; choosing later saves the later instant', () => {
  act(() => { view = create(<ChartEditorScreen />); });
  field('Chart name', 'Fold'); field('Date · YYYY-MM-DD', '2026-11-01'); field('Time · HH:mm:ss (24-hour)', '01:30');
  act(() => action('Save chart').props.onPress()); expect(mockState.saveChart).not.toHaveBeenCalled();
  act(() => button('This time occurs twice: Later · 2026-11-01T09:30:00.000Z').props.onPress());
  act(() => action('Save chart').props.onPress());
  expect(mockState.saveChart.mock.calls[0][0].datetime).toBe('2026-11-01T09:30:00.000Z');
});
test('fourth chart cannot open until an explicit existing instance is chosen', () => {
  mockState.active = ['a', 'b', 'c'].map(instance);
  mockState.saved = [{ id: 's', name: 'Saved', datetime: '1990-07-05T21:30:00Z', settings: DEFAULT_SETTINGS }];
  mockState.openSaved.mockReturnValueOnce(false).mockReturnValue(true);
  act(() => { view = create(<SavedChartsScreen />); });
  act(() => button('Open Saved').props.onPress());
  expect(view.root.findByType(Modal).props.visible).toBe(true);
  expect(mockRouter.dismissTo).not.toHaveBeenCalled();
  act(() => button('Replace ring 2: Natal').props.onPress());
  expect(mockState.openSaved).toHaveBeenLastCalledWith('s', 'b');
  expect(mockRouter.dismissTo).toHaveBeenCalledTimes(1);
});
test('cards target stable identities and reordering only invokes move', () => {
  mockState.active = ['a', 'b'].map(instance);
  act(() => { view = create(<ActiveChartCards />); });
  act(() => button('Step Natal, ring 2').props.onPress());
  expect(mockState.selectTarget).toHaveBeenCalledWith('b');
  mockState.selectTarget.mockClear();
  const menu = view.root.findByType(MenuView);
  act(() => menu.props.onPressAction({ nativeEvent: { event: 'outward' } }));
  expect(mockState.move).toHaveBeenCalledWith('a', 1);
  expect(mockState.selectTarget).not.toHaveBeenCalled();
  act(() => menu.props.onPressAction({ nativeEvent: { event: 'reset' } })); expect(mockState.reset).toHaveBeenCalledTimes(1);
});

test('removing the last chart while cards are hidden leaves an add-chart entry point', () => {
  mockState.active = [instance('a')];
  act(() => { view = create(<ActiveChartCards />); });
  act(() => view.root.findByType(MenuView).props.onPressAction({ nativeEvent: { event: 'collapse' } }));
  act(() => view.root.findByType(MenuView).props.onPressAction({ nativeEvent: { event: 'remove' } }));
  expect(mockState.remove).toHaveBeenCalledWith('a');
  mockState.active = [];
  act(() => view.update(<ActiveChartCards />));
  act(() => button('Add / saved charts').props.onPress());
  expect(mockRouter.push).toHaveBeenCalledWith('/charts');
});

test('failed hydration exposes retry instead of an indefinite loading state', () => {
  mockState.loaded = false; mockState.loadError = true;
  act(() => { view = create(<ChartEditorScreen />); });
  act(() => action('Retry loading').props.onPress());
  expect(mockState.retryLoad).toHaveBeenCalledTimes(1);
  act(() => view.update(<SavedChartsScreen />));
  expect(action('Retry loading')).toBeDefined();
});
test('editing a saved fold chart preserves its occurrence when only the name changes', () => {
  mockParams = { id: 'fold' };
  mockState.saved = [{ id: 'fold', name: 'Fold', datetime: '2026-11-01T09:30:00.000Z', settings: DEFAULT_SETTINGS }];
  act(() => { view = create(<ChartEditorScreen />); });
  field('Chart name', 'Renamed');
  act(() => action('Save chart').props.onPress());
  expect(mockState.saveChart).toHaveBeenCalledWith({ name: 'Renamed', datetime: '2026-11-01T09:30:00.000Z', settings: DEFAULT_SETTINGS }, 'fold');
});
