import { context } from '../../actions/testContext';
import { useActionRegistry } from '../../actions/useActionRegistry';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Modal, TextInput } from 'react-native';
import { MenuView } from '@react-native-menu/menu';
import ChartEditorScreen from '@/app/chart-editor';
import SavedChartsScreen from '@/app/charts';
import { ActiveChartCards } from '../ActiveChartCards';
import { useCardDragSession } from '../useCardDragSession';
import { Action } from '../../display/controls';
import { DEFAULT_SETTINGS, LEGACY_CALCULATION } from '../../settings/chartSettings';

let mockParams: { id?: string } = {};
const mockRouter = { back: jest.fn(), push: jest.fn(), dismissTo: jest.fn() };
const mockState = {
  tagSuggestionsFor: jest.fn().mockResolvedValue([]), loaded: true, loadError: false, saveError: false, saving: false,
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
jest.mock('../cardHaptics', () => ({ cardHaptic: jest.fn() }));
jest.mock('react-native-reanimated', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    default: { View: jest.requireActual('react-native').View, createAnimatedComponent: (component: unknown) => component }, __esModule: true,
    useReducedMotion: () => false, ReduceMotion: { Always: 'always', Never: 'never' },
    useSharedValue: (initial: unknown) => React.useRef({ value: initial }).current,
    useAnimatedReaction: () => {}, withTiming: (value: number) => value,
    useAnimatedStyle: (calculate: () => unknown) => calculate(),
    runOnJS: (fn: unknown) => fn, cancelAnimation: () => {}, Easing: { linear: (t: number) => t }, withSpring: (value: number) => value,
  };
});
jest.mock('../../marking/MarkingMenu', () => ({ MarkingMenuButton: (props: any) => {
  const { Pressable } = jest.requireActual('react-native');
  return <Pressable accessibilityLabel={props.label} onPress={props.onPress}>{props.children}</Pressable>;
} }));
jest.mock('../../marking/MarkingIcon', () => ({ MarkingIcon: 'MarkingIcon' }));
function Cards() {
  const actions = useActionRegistry({ ...context(), openLibrary: () => mockRouter.push('/charts') });
  const session = useCardDragSession({ ids: mockState.active.map(chart => chart.id), viewport: { x: 0, y: 0, width: 400, height: 800 }, enabled: true, onDrop: jest.fn() });
  return <ActiveChartCards session={session} chartActions={actions} />;
}
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

test('create validates input and saves the chosen local time as UTC before opening', async () => {
  act(() => { view = create(<ChartEditorScreen />); });
  await act(async () => { action('Save and open').props.onPress(); });
  expect(mockState.saveChart).not.toHaveBeenCalled();
  field('Chart name', 'Natal'); field('Date · YYYY-MM-DD', '1990-07-05'); field('Time · HH:mm:ss (24-hour)', '14:30');
  await act(async () => { action('Save and open').props.onPress(); });
  expect(mockState.saveChart).toHaveBeenCalledWith({ name: 'Natal', datetime: '1990-07-05T21:30:00.000Z', settings: { ...DEFAULT_SETTINGS, ...LEGACY_CALCULATION } }, undefined, undefined);
  expect(mockState.openSaved).toHaveBeenCalledWith('saved-1', undefined);
  expect(mockRouter.dismissTo).toHaveBeenCalledWith('/(tabs)/(chart)');
});
test('ambiguous local time requires explicit occurrence; choosing later saves the later instant', async () => {
  act(() => { view = create(<ChartEditorScreen />); });
  field('Chart name', 'Fold'); field('Date · YYYY-MM-DD', '2026-11-01'); field('Time · HH:mm:ss (24-hour)', '01:30');
  await act(async () => { action('Save chart').props.onPress(); }); expect(mockState.saveChart).not.toHaveBeenCalled();
  act(() => button('This time occurs twice: Later · 2026-11-01T09:30:00.000Z').props.onPress());
  await act(async () => { action('Save chart').props.onPress(); });
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
  act(() => { view = create(<Cards />); });
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
  act(() => { view = create(<Cards />); });
  act(() => view.root.findByType(MenuView).props.onPressAction({ nativeEvent: { event: 'collapse' } }));
  act(() => view.root.findByType(MenuView).props.onPressAction({ nativeEvent: { event: 'remove' } }));
  expect(mockState.remove).toHaveBeenCalledWith('a');
  mockState.active = [];
  act(() => view.update(<Cards />));
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
test('editing a saved fold chart preserves its occurrence when only the name changes', async () => {
  mockParams = { id: 'fold' };
  mockState.saved = [{ id: 'fold', name: 'Fold', datetime: '2026-11-01T09:30:00.000Z', settings: DEFAULT_SETTINGS }];
  act(() => { view = create(<ChartEditorScreen />); });
  field('Chart name', 'Renamed');
  await act(async () => { action('Save chart').props.onPress(); });
  expect(mockState.saveChart).toHaveBeenCalledWith({ name: 'Renamed', datetime: '2026-11-01T09:30:00.000Z', settings: { ...DEFAULT_SETTINGS, ...LEGACY_CALCULATION } }, 'fold', { name: 'Fold', datetime: '2026-11-01T09:30:00.000Z', settings: DEFAULT_SETTINGS });
});

test('a remote deletion keeps the open editor draft and its original baseline', async () => {
  mockParams = { id: 'editing' };
  const original = { id: 'editing', name: 'Original', datetime: '1990-07-05T21:30:00.000Z', settings: DEFAULT_SETTINGS };
  mockState.saved = [original];
  act(() => { view = create(<ChartEditorScreen />); });
  field('Chart name', 'My unsaved edit');
  mockState.saved = [];
  act(() => view.update(<ChartEditorScreen />));
  expect(view.root.findAllByType(TextInput).find(node => node.props.accessibilityLabel === 'Chart name')!.props.value).toBe('My unsaved edit');
  await act(async () => { action('Save chart').props.onPress(); });
  expect(mockState.saveChart).toHaveBeenCalledWith(expect.objectContaining({ name: 'My unsaved edit' }), 'editing', {
    name: original.name, datetime: original.datetime, settings: original.settings,
  });
});
