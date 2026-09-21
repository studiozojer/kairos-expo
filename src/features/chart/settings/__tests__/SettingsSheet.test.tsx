import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Modal, TextInput } from 'react-native';
import { SettingsSheet } from '../SettingsSheet';
import { DEFAULT_SETTINGS } from '../chartSettings';
import { searchAtlas } from '../atlas';

jest.mock('../atlas', () => ({ searchAtlas: jest.fn() }));
let view: ReactTestRenderer;
const london = { name: 'London, England, GB', latitude: 51.5, longitude: -0.12, elevation: 0, timezone: 'Europe/London' };
const paris = { ...london, name: 'Paris, FR', latitude: 48.85, longitude: 2.35, timezone: 'Europe/Paris' };
const button = (label: string) => view.root.findAll(node => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function')[0];
beforeEach(() => { jest.useFakeTimers(); jest.mocked(searchAtlas).mockReset(); });
afterEach(() => { act(() => view.unmount()); jest.useRealTimers(); });

test('house selection updates the open chart settings and exposes the selected value', () => {
  const onChange = jest.fn();
  const props = { visible: true, settings: DEFAULT_SETTINGS, saveError: false, onChange, onClose: jest.fn() };
  act(() => { view = create(<SettingsSheet {...props} />); });
  act(() => button('House system').props.onPress());
  expect(button('Placidus').props.accessibilityState.checked).toBe(true);
  act(() => button('Whole Sign').props.onPress());
  expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_SETTINGS, houseSystem: 'Whole Sign' });
  act(() => view.update(<SettingsSheet {...props} settings={{ ...DEFAULT_SETTINGS, houseSystem: 'Whole Sign' }} />));
  expect(button('Whole Sign').props.accessibilityState.checked).toBe(true);
});

test('stale atlas results cannot replace a newer search or select the wrong city', async () => {
  let finishOld!: (value: typeof london[]) => void;
  jest.mocked(searchAtlas).mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; })).mockResolvedValue([paris]);
  const onChange = jest.fn();
  act(() => { view = create(<SettingsSheet visible settings={DEFAULT_SETTINGS} saveError={false} onChange={onChange} onClose={jest.fn()} />); });
  act(() => button('Location').props.onPress());
  act(() => view.root.findByType(TextInput).props.onChangeText('London'));
  await act(async () => { jest.advanceTimersByTime(250); });
  act(() => view.root.findByType(TextInput).props.onChangeText('Paris'));
  await act(async () => { jest.advanceTimersByTime(250); });
  await act(async () => { finishOld([london]); });
  expect(button(london.name)).toBeUndefined();
  act(() => button(paris.name).props.onPress());
  expect(onChange).toHaveBeenLastCalledWith({ ...DEFAULT_SETTINGS, location: paris });
  expect(button('Location')).toBeDefined();
});

// Modal retains its children during iOS dismissal even after visible becomes false.
test('closing retains the settings surface until native dismissal completes', () => {
  const props = { visible: true, settings: DEFAULT_SETTINGS, saveError: false, onChange: jest.fn(), onClose: jest.fn() };
  act(() => { view = create(<SettingsSheet {...props} />); });
  const open = view.root.findByType(Modal).props;
  const editor = open.children.props.children.props.children;
  expect(editor).toBeTruthy();
  act(() => view.update(<SettingsSheet {...props} visible={false} />));
  const closing = view.root.findByType(Modal).props;
  expect(closing.visible).toBe(false);
  expect(closing.children.props.children.props.children.type).toBe(editor.type);
  expect(closing.backdropColor).toBeDefined();
  expect(closing.backdropColor).toBe(open.backdropColor);
});
