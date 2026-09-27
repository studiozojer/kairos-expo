import { act, create } from 'react-test-renderer';
import { AppState, Text, View, type AppStateStatus } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';
import { MarkingMenuProvider, MarkingMenuButton } from '../MarkingMenu';
jest.mock('expo-blur', () => ({ BlurView: 'BlurView', BlurTargetView: 'BlurTargetView' }));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(() => Promise.resolve()), ImpactFeedbackStyle: { Light: 'light' } }));
jest.mock('react-native-reanimated', () => ({
  __esModule: true, default: { View: jest.requireActual('react-native').View },
  useAnimatedStyle: (fn: () => unknown) => fn(), withSpring: (n: number) => n, ReduceMotion: { Always: 'always', Never: 'never' },
}));
let view: ReturnType<typeof create>;
beforeEach(() => jest.useFakeTimers());
afterEach(() => { act(() => view?.unmount()); jest.useRealTimers(); jest.restoreAllMocks(); });
function Probe({ enabled = true, disabled = false, action = jest.fn() }) {
  return <MarkingMenuProvider enabled={enabled}><MarkingMenuButton id="test" label="Test menu" disabled={disabled} onPress={action}><Text>Icon</Text></MarkingMenuButton></MarkingMenuProvider>;
}
const touch = { absoluteX: 100, absoluteY: 100, x: 22, y: 22, translationX: 0, translationY: 0 };
const pan = () => getByGestureTestId('marking-test') as ReturnType<typeof Gesture.Pan>;
test('gesture tap and screen-reader activation call primary action; disabled blocks activation', async () => {
  const action = jest.fn();
  await act(async () => { view = create(<Probe action={action} />); });
  act(() => fireGestureHandler(pan(), [touch]));
  expect(action).toHaveBeenCalledTimes(1);
  const button = () => view.root.findAll(n => n.props.accessibilityLabel === 'Test menu' && !!n.props.onAccessibilityTap)[0];
  act(() => button().props.onAccessibilityTap());
  expect(action).toHaveBeenCalledTimes(2);
  act(() => view.update(<Probe action={action} disabled />));
  act(() => button().props.onAccessibilityTap());
  expect(action).toHaveBeenCalledTimes(2);
});
test('route disable cancels an open menu and a later release cannot run the old tap', async () => {
  const action = jest.fn();
  await act(async () => { view = create(<Probe action={action} />); });
  const handlers = pan().handlers;
  act(() => handlers.onBegin!(touch as never));
  act(() => jest.advanceTimersByTime(100));
  expect(view.root.findAll(n => n.type === View && n.props.testID === 'marking-menu-overlay')).toHaveLength(1);
  act(() => view.update(<Probe enabled={false} action={action} />));
  expect(view.root.findAll(n => n.type === View && n.props.testID === 'marking-menu-overlay')).toHaveLength(0);
  act(() => handlers.onEnd!(touch as never, true));
  expect(action).not.toHaveBeenCalled();
});
test('app background cancels reveal and selection', async () => {
  let onState: (state: AppStateStatus) => void = () => {};
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, cb) => { onState = cb; return { remove: jest.fn() }; });
  const action = jest.fn();
  await act(async () => { view = create(<Probe action={action} />); });
  const handlers = pan().handlers;
  act(() => handlers.onBegin!(touch as never));
  act(() => onState('background'));
  act(() => jest.advanceTimersByTime(200));
  act(() => handlers.onEnd!(touch as never, true));
  expect(action).not.toHaveBeenCalled();
  expect(view.root.findAll(n => n.type === View && n.props.testID === 'marking-menu-overlay')).toHaveLength(0);
});
