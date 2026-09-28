import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { GestureDetector } from 'react-native-gesture-handler';
import { TimeStepper } from '../TimeStepper';
import { IntervalCarousel } from '../IntervalCarousel';
import { TimeStepButton } from '../TimeStepButton';
// Exercise the real gesture definitions; native delivery remains a device check.
jest.mock('react-native-gesture-handler', () => ({
  ...jest.requireActual('react-native-gesture-handler'), GestureDetector: 'GestureDetector',
}));
jest.mock('../stepperHaptics', () => ({ stepperHaptic: jest.fn() }));
jest.mock('react-native-reanimated', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const RN = jest.requireActual('react-native');
  return { __esModule: true, default: { View: RN.View, Text: RN.Text, createAnimatedComponent: (component: unknown) => component },
    useSharedValue: (v: unknown) => React.useRef({ value: v }).current,
    useAnimatedStyle: (fn: () => unknown) => fn(), withSpring: (v: number) => v, withTiming: (v: number) => v,
    cancelAnimation: jest.fn(), runOnJS: (fn: unknown) => fn, ReduceMotion: { System: 'system' } };
});
const mockClock = { time: 0, origin: 0, unit: 2, kind: 'saved', status: 'ready', reset: jest.fn(),
  selectUnit: jest.fn(), step: jest.fn(), canStepBackward: true, canStepForward: true };
jest.mock('../ChartTimeContext', () => ({ useChartTime: () => mockClock }));
let view: ReactTestRenderer;
beforeEach(() => { jest.clearAllMocks(); mockClock.unit = 2; mockClock.canStepBackward = mockClock.canStepForward = true; });
afterEach(() => act(() => view?.unmount()));
const surface = () => view.root.findAll(n => n.props.testID === 'time-interval-carousel')[0];
const gestures = () => view.root.findByType(GestureDetector).props.gesture.gestures;
test('arrows flank carousel with Swift padding; saved originals display Origin', () => {
  act(() => { view = create(<TimeStepper />); });
  const row = view.root.findByType(TimeStepper).children[0] as any;
  expect(row.props.style).toMatchObject({ paddingHorizontal: 8, paddingVertical: 6 });
  expect(row.findAllByType(TimeStepButton).map((n: any) => n.props.direction)).toEqual([-1, 1]);
  expect(view.root.findByType(IntervalCarousel).props.offsetLabel).toBe('Origin');
});
test('horizontal release commits once, cancellation does not, double tap resets', () => {
  act(() => { view = create(<TimeStepper />); });
  const [pan, reset] = gestures();
  act(() => pan.handlers.onStart());
  act(() => pan.handlers.onUpdate({ translationX: -60 }));
  expect(mockClock.selectUnit).not.toHaveBeenCalled();
  act(() => { pan.handlers.onEnd({ translationX: -60, translationY: 0, velocityX: -100 }, true); pan.handlers.onFinalize(); });
  expect(mockClock.selectUnit).toHaveBeenCalledWith(3);
  act(() => { pan.handlers.onStart(); pan.handlers.onUpdate({ translationX: -160 }); pan.handlers.onFinalize(); });
  expect(mockClock.selectUnit).toHaveBeenCalledTimes(1);
  act(() => reset.handlers.onEnd({}, true)); expect(mockClock.reset).toHaveBeenCalledTimes(1);
});
test('accessibility changes interval/reset; disabled controls reject late gesture releases', () => {
  act(() => { view = create(<TimeStepper />); });
  act(() => surface().props.onAccessibilityAction({ nativeEvent: { actionName: 'increment' } }));
  expect(mockClock.selectUnit).toHaveBeenCalledWith(3);
  const [pan] = gestures(); act(() => pan.handlers.onStart());
  mockClock.canStepBackward = mockClock.canStepForward = false;
  act(() => view.update(<TimeStepper />));
  act(() => pan.handlers.onEnd({ translationX: -100, translationY: 0, velocityX: -100 }, true));
  act(() => surface().props.onAccessibilityAction({ nativeEvent: { actionName: 'reset' } }));
  expect(mockClock.selectUnit).toHaveBeenCalledTimes(1); expect(mockClock.reset).not.toHaveBeenCalled();
});

test('intent detection accepts diagonal horizontal movement and yields vertical movement', () => {
  act(() => { view = create(<TimeStepper />); });
  const [pan] = gestures(), manager = { activate: jest.fn(), fail: jest.fn() };
  const touches = (x: number, y: number) => ({ numberOfTouches: 1, allTouches: [{ absoluteX: x, absoluteY: y }] });
  act(() => pan.handlers.onTouchesDown(touches(0, 0)));
  act(() => pan.handlers.onTouchesMove(touches(4, 2), manager));
  expect(manager.activate).not.toHaveBeenCalled(); expect(manager.fail).not.toHaveBeenCalled();
  act(() => pan.handlers.onTouchesMove(touches(20, 6), manager));
  expect(manager.activate).toHaveBeenCalledTimes(1);
  act(() => pan.handlers.onTouchesMove(touches(6, 20), manager));
  expect(manager.fail).toHaveBeenCalledTimes(1);
});
test('unmounted target rejects a late carousel release and reset', () => {
  act(() => { view = create(<TimeStepper />); });
  const [pan, reset] = gestures();
  act(() => pan.handlers.onStart());
  act(() => view.unmount());
  act(() => pan.handlers.onEnd({ translationX: -100, translationY: 0, velocityX: -100 }, true));
  act(() => reset.handlers.onEnd({}, true));
  expect(mockClock.selectUnit).not.toHaveBeenCalled(); expect(mockClock.reset).not.toHaveBeenCalled();
});
