import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AppState } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import { EventStepper, type EventStepperProps } from '../EventStepper';
import { findEvent } from '../api';
import type { EventSearchResult } from '../types';
jest.mock('../api', () => ({ findEvent: jest.fn() }));
jest.mock('../../time/TimeStepButton', () => ({ TimeStepButton: 'TimeStepButton' }));
jest.mock('../../time/stepperHaptics', () => ({ stepperHaptic: jest.fn() }));
jest.mock('../../components/ChartSheet', () => ({ ChartSheet: ({ visible, children }: any) => visible ? children : null, SheetHeader: 'SheetHeader' }));
jest.mock('react-native-gesture-handler', () => ({ ...jest.requireActual('react-native-gesture-handler'), GestureDetector: 'GestureDetector' }));
const mockedFind = jest.mocked(findEvent);
const now = Date.parse('2026-09-01T00:00:00Z');
const next = { time: '2026-09-02T00:00:00Z', kind: 'station' as const, body: 'Mercury' as const, direction: 'direct' as const };
let props: EventStepperProps, view: ReactTestRenderer;
let pending: (result: EventSearchResult) => void;
const surface = () => view.root.findAll(n => n.props.testID === 'event-timeline')[0];
const action = (name: string) => act(() => surface().props.onAccessibilityAction({ nativeEvent: { actionName: name } }));
beforeEach(() => {
  jest.clearAllMocks();
  props = { mode: { key: 'mercury', label: 'Mercury motion', kind: 'motion', query: { zodiac: 'tropical', bodies: ['Mercury'], kinds: ['ingress', 'station'], aspects: [] } },
    capabilities: { schema_version: 1, available: true, supported_from: '1900-02-04T00:00:00Z', supported_to: '2199-11-28T00:00:00Z', max_window_days: 31, max_events: 500, bodies: ['Mercury'], aspects: [], kinds: ['ingress', 'station'], modes: ['moving_moving'], zodiac: 'tropical', reason: 'available' },
    time: now, origin: now, timezone: 'America/Los_Angeles', kind: 'saved', enabled: true, onSeek: jest.fn(() => true), onReset: jest.fn(), onUnavailable: jest.fn() };
  mockedFind.mockImplementation(() => new Promise(resolve => { pending = resolve; }));
  act(() => { view = create(<EventStepper {...props} />); });
});
afterEach(() => act(() => view.unmount()));
const resolve = async (result: EventSearchResult) => { await act(async () => { pending(result); }); };
test('serializes navigation and commits the nearest event without touching reset', async () => {
  action('increment'); action('increment'); expect(mockedFind).toHaveBeenCalledTimes(1);
  await resolve({ event: next, boundary: now, exhausted: false });
  expect(props.onSeek).toHaveBeenCalledWith(Date.parse(next.time)); expect(props.onReset).not.toHaveBeenCalled();
});
test('external chart time change aborts and rejects a late response', async () => {
  action('increment'); const signal = mockedFind.mock.calls[0][4];
  act(() => view.update(<EventStepper {...props} time={now + 1000} />));
  expect(signal.aborted).toBe(true); await resolve({ event: next, boundary: now, exhausted: false });
  expect(props.onSeek).not.toHaveBeenCalled();
});
test('new callback identity does not discard a valid search; latest callback owns commit', async () => {
  action('increment'); const onSeek = jest.fn(() => true);
  act(() => view.update(<EventStepper {...props} onSeek={onSeek} />));
  await resolve({ event: next, boundary: now, exhausted: false });
  expect(onSeek).toHaveBeenCalledWith(Date.parse(next.time)); expect(props.onSeek).not.toHaveBeenCalled();
});
test('empty windows continue exactly at the boundary and never seek chart time', async () => {
  action('increment'); await resolve({ event: null, boundary: now + 86400000, exhausted: false });
  expect(surface().props.accessibilityLabel).toContain('No events through'); expect(props.onSeek).not.toHaveBeenCalled();
  action('increment'); expect(mockedFind.mock.calls[1][1]).toBe(now + 86400000); expect(mockedFind.mock.calls[1][5]).toBe(false);
});
test('motion filters cancel pending search and narrow query', async () => {
  action('increment'); const signal = mockedFind.mock.calls[0][4]; action('filters'); expect(signal.aborted).toBe(true);
  const ingress = view.root.findAll(n => n.props.accessibilityLabel === 'Ingress' && typeof n.props.onPress === 'function')[0];
  act(() => ingress.props.onPress()); action('increment');
  expect(mockedFind.mock.calls[1][0].kinds).toEqual(['ingress']);
});
test('service failure is distinct from empty and preserves chart time', async () => {
  mockedFind.mockRejectedValueOnce(new Error('network'));
  await act(async () => { surface().props.onAccessibilityAction({ nativeEvent: { actionName: 'increment' } }); });
  expect(props.onUnavailable).toHaveBeenCalledTimes(1); expect(props.onSeek).not.toHaveBeenCalled();
  expect(surface().props.accessibilityLabel).toContain('unavailable');
});
test('disabled/unmounted controls reject late work', async () => {
  action('increment'); act(() => view.update(<EventStepper {...props} enabled={false} />));
  await resolve({ event: next, boundary: now, exhausted: false }); action('reset');
  expect(props.onSeek).not.toHaveBeenCalled(); expect(props.onReset).not.toHaveBeenCalled();
});
test('background aborts pending work', async () => {
  const add = jest.spyOn(AppState, 'addEventListener');
  act(() => view.unmount()); act(() => { view = create(<EventStepper {...props} />); });
  action('increment'); const listeners = add.mock.calls.filter(c => c[0] === 'change').map(c => c[1]);
  act(() => listeners.forEach(listener => listener('background'))); await resolve({ event: next, boundary: now, exhausted: false });
  expect(props.onSeek).not.toHaveBeenCalled();
});
test('gesture definitions navigate only on successful horizontal release and double tap resets', () => {
  const detector = view.root.findByType(GestureDetector);
  const [pan, taps] = detector.props.gesture.gestures;
  act(() => pan.handlers.onEnd({ translationX: -50 }, false)); expect(mockedFind).not.toHaveBeenCalled();
  act(() => pan.handlers.onEnd({ translationX: -50 }, true)); expect(mockedFind).toHaveBeenCalledTimes(1);
  act(() => taps.gestures[0].handlers.onEnd({}, true)); expect(props.onReset).toHaveBeenCalledTimes(1);
  expect(mockedFind.mock.calls[0][4].aborted).toBe(true);
});
test('unmounted gesture handlers cannot reset or seek', async () => {
  const detector = view.root.findByType(GestureDetector);
  const [pan, taps] = detector.props.gesture.gestures;
  action('increment'); act(() => view.unmount());
  act(() => pan.handlers.onEnd({ translationX: -50 }, true)); act(() => taps.gestures[0].handlers.onEnd({}, true));
  await resolve({ event: next, boundary: now, exhausted: false });
  expect(props.onSeek).not.toHaveBeenCalled(); expect(props.onReset).not.toHaveBeenCalled(); expect(mockedFind).toHaveBeenCalledTimes(1);
});
test('aspect filter can only request enabled aspect types', () => {
  act(() => view.update(<EventStepper {...props} mode={{ key: 'pair', label: 'Mercury / Sun', kind: 'aspect', query: { zodiac: 'tropical', bodies: ['Mercury', 'Sun'], kinds: ['aspect'], aspects: ['Conjunction', 'Square'] } }} />));
  action('filters');
  const square = view.root.findAll(n => n.props.accessibilityLabel === 'Square' && typeof n.props.onPress === 'function')[0];
  expect(view.root.findAll(n => n.props.accessibilityLabel === 'Opposition')).toHaveLength(0);
  act(() => square.props.onPress()); action('increment'); expect(mockedFind.mock.calls[0][0].aspects).toEqual(['Square']);
});
test('service limit disables only exhausted direction; reset clears continuation', async () => {
  action('increment'); await resolve({ event: null, boundary: now + 86400000, exhausted: true });
  action('increment'); expect(mockedFind).toHaveBeenCalledTimes(1);
  action('decrement'); expect(mockedFind).toHaveBeenCalledTimes(2);
  action('reset'); action('increment'); expect(mockedFind).toHaveBeenCalledTimes(3); expect(mockedFind.mock.calls[2][1]).toBe(now);
});
test('arbitrary time searches do not skip close events; landed event skips itself on next step', async () => {
  const near = { ...next, time: new Date(now + 500).toISOString() };
  action('increment'); expect(mockedFind.mock.calls[0][5]).toBe(false);
  await resolve({ event: near, boundary: now, exhausted: false });
  act(() => view.update(<EventStepper {...props} time={now + 500} />));
  action('increment'); expect(mockedFind.mock.calls[1][5]).toBe(true);
});
