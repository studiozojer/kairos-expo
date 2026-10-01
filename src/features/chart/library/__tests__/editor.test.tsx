import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Stack } from 'expo-router';
import { ReplacementChooser } from '../../active/ReplacementChooser';
import { TextInput } from 'react-native';
import ChartEditorScreen from '@/app/chart-editor';
import { Action } from '../../display/controls';
import { DEFAULT_SETTINGS } from '../../settings/chartSettings';

let mockParams: { id?: string; duplicate?: string; fromLibrary?: string } = {};
const mockRouter = { back: jest.fn(), dismissTo: jest.fn() };
const original = { id: 'source', name: 'Natal', datetime: '2000-01-01T12:00:00.000Z', settings: DEFAULT_SETTINGS, metadata: { favorite: true, tags: [{ id: 'family', name: 'Family' }] } };
const mockState = {
  loaded: true, saved: [original], active: [], scope: null,
  tagSuggestionsFor: jest.fn().mockResolvedValue([{ id: 'friends', name: 'Friends' }]),
  saveChart: jest.fn(), openSaved: jest.fn().mockReturnValue(true),
};
jest.mock('expo-router', () => ({ useRouter: () => mockRouter, useLocalSearchParams: () => mockParams, Stack: { Screen: () => null } }));
jest.mock('../../active/ActiveChartsContext', () => ({ useActiveCharts: () => mockState }));
jest.mock('../../settings/atlas', () => ({ searchAtlas: jest.fn().mockResolvedValue([]) }));
let view: ReactTestRenderer;
const press = async (label: string) => act(async () => { view.root.findAllByType(Action).find(node => node.props.label === label)!.props.onPress(); });
const field = (label: string, value: string) => act(() => view.root.findAllByType(TextInput).find(node => node.props.accessibilityLabel === label)!.props.onChangeText(value));
const tag = (label: string) => act(() => view.root.findAll(node => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0].props.onPress());
beforeEach(() => {
  jest.clearAllMocks(); mockState.openSaved.mockReturnValue(true); mockParams = { id: 'source', fromLibrary: '1' }; mockState.saved = [original];
  mockState.saveChart.mockImplementation(async (draft, id) => ({ ...draft, id: id ?? 'new-chart' }));
});
afterEach(() => act(() => view?.unmount()));

test('editing assigns existing tags, creates a trimmed tag, removes tags and retains favorite', async () => {
  await act(async () => { view = create(<ChartEditorScreen />); });
  expect(mockState.tagSuggestionsFor).toHaveBeenCalledWith('source');
  tag('Add tag Friends'); tag('Remove tag Family');
  field('Tag name', '  Work  '); await press('Create “Work”');
  await press('Save chart');
  expect(mockState.saveChart.mock.calls[0][0].metadata).toEqual({ favorite: true, tags: [{ id: 'friends', name: 'Friends' }, { id: expect.any(String), name: 'Work' }] });
  expect(mockState.saveChart.mock.calls[0][2].metadata).toEqual(original.metadata);
  expect(mockRouter.back).toHaveBeenCalledTimes(1);
});

test('duplicate prefills metadata and time but saves with a new identity and no edit baseline', async () => {
  mockParams = { duplicate: 'source', fromLibrary: '1' };
  await act(async () => { view = create(<ChartEditorScreen />); });
  expect(mockState.tagSuggestionsFor).toHaveBeenCalledWith(undefined);
  await press('Save chart');
  expect(mockState.saveChart).toHaveBeenCalledWith({ name: 'Natal copy', datetime: original.datetime, settings: DEFAULT_SETTINGS, metadata: original.metadata }, undefined, undefined);
  expect(original.metadata.tags).toEqual([{ id: 'family', name: 'Family' }]);
});

test('save and open dismisses to wheel, save failures and conflict copies remain visible', async () => {
  await act(async () => { view = create(<ChartEditorScreen />); });
  mockState.saveChart.mockRejectedValueOnce(new Error('Account changed'));
  await press('Save and open'); expect(mockRouter.dismissTo).not.toHaveBeenCalled(); expect(mockRouter.back).not.toHaveBeenCalled();
  mockState.saveChart.mockImplementationOnce(async draft => ({ ...draft, id: 'conflict-copy' }));
  await press('Save and open'); expect(mockState.openSaved).not.toHaveBeenCalled();
  await press('Save and open');
  expect(mockState.openSaved).toHaveBeenCalledWith('conflict-copy', undefined);
  expect(mockRouter.dismissTo).toHaveBeenCalledWith('/(tabs)/(chart)');
});

test('case-insensitive existing name reuses its ID instead of creating a duplicate tag', async () => {
  await act(async () => { view = create(<ChartEditorScreen />); });
  field('Tag name', 'friends'); await press('Add “friends”');
  field('Tag name', 'FRIENDS'); await press('Add “FRIENDS”');
  await press('Save chart');
  expect(mockState.saveChart.mock.calls[0][0].metadata.tags).toEqual([...original.metadata.tags, { id: 'friends', name: 'Friends' }]);
});

test('a save resolving after editor unmount cannot navigate the next account session', async () => {
  let finish!: (chart: typeof original) => void;
  mockState.saveChart.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await act(async () => { view = create(<ChartEditorScreen />); });
  await press('Save and open');
  act(() => view.unmount());
  await act(async () => { finish(original); });
  expect(mockRouter.dismissTo).not.toHaveBeenCalled();
  expect(mockRouter.back).not.toHaveBeenCalled();
  expect(mockState.openSaved).not.toHaveBeenCalled();
});

test.each(['Save chart', 'Save and open'])('new typing during %s stays in editor and the next save updates the saved baseline', async label => {
  let finish!: (chart: typeof original) => void;
  mockState.saveChart.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await act(async () => { view = create(<ChartEditorScreen />); });
  await press(label);
  field('Chart name', 'Newer typing');
  await act(async () => { finish(original); });
  expect(mockRouter.back).not.toHaveBeenCalled();
  expect(mockRouter.dismissTo).not.toHaveBeenCalled();
  expect(mockState.openSaved).not.toHaveBeenCalled();
  expect(view.root.findAllByType(TextInput).find(node => node.props.accessibilityLabel === 'Chart name')!.props.value).toBe('Newer typing');
  await press('Save chart');
  expect(mockState.saveChart.mock.calls[1][0].name).toBe('Newer typing');
  expect(mockState.saveChart.mock.calls[1][1]).toBe(original.id);
  expect(mockState.saveChart.mock.calls[1][2].name).toBe(original.name);
  expect(mockRouter.back).toHaveBeenCalledTimes(1);
});

test('editor supplies an accessible cancel header action', async () => {
  await act(async () => { view = create(<ChartEditorScreen />); });
  const header = view.root.findByType(Stack.Screen).props.options.headerLeft();
  expect(header.props.accessibilityRole).toBe('button');
  expect(header.props.accessibilityLabel).toBe('Cancel chart editing');
  act(() => header.props.onPress());
  expect(mockRouter.back).toHaveBeenCalledTimes(1);
  expect(mockState.saveChart).not.toHaveBeenCalled();
});

test('a chart deleted while replacement chooser is open closes chooser and preserves the draft', async () => {
  mockState.openSaved.mockReturnValue(false);
  await act(async () => { view = create(<ChartEditorScreen />); });
  await press('Save and open');
  expect(view.root.findByType(ReplacementChooser).props.visible).toBe(true);
  mockState.saved = [];
  await act(async () => { view.update(<ChartEditorScreen />); });
  act(() => view.root.findByType(ReplacementChooser).props.onSelect('ring-1'));
  expect(view.root.findByType(ReplacementChooser).props.visible).toBe(false);
  expect(mockState.openSaved).toHaveBeenCalledTimes(1);
  expect(mockRouter.dismissTo).not.toHaveBeenCalled();
  expect(view.root.findAllByType(TextInput).find(node => node.props.accessibilityLabel === 'Chart name')!.props.value).toBe(original.name);
});
