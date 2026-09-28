import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AppState, type AppStateStatus } from 'react-native';
import { TimeStepButton } from '../TimeStepButton';
jest.mock('../stepperHaptics', () => ({ stepperHaptic: jest.fn() }));
jest.mock('react-native-reanimated', () => ({ __esModule: true,
  default: { View: jest.requireActual('react-native').View },
  useAnimatedStyle: (fn: () => unknown) => fn(), withTiming: (n: number) => n, ReduceMotion: { System: 'system' },
}));
let view: ReactTestRenderer;
beforeEach(() => jest.useFakeTimers());
afterEach(() => { act(() => view?.unmount()); jest.useRealTimers(); jest.restoreAllMocks(); });
const event = (count = 1) => ({ nativeEvent: { touches: Array(count).fill({}) } });
const surface = () => view.root.findAll(node => node.props.testID === 'time-step-1')[0];
function mount(step: jest.Mock, enabled = true) {
  act(() => { view = create(<TimeStepButton direction={1} interval="1 day" enabled={enabled} onStep={step} />); });
}
test('steps on touch down, repeats after the Swift ramp, and ends on release', () => {
  const step = jest.fn(); mount(step);
  act(() => surface().props.onResponderGrant(event())); expect(step).toHaveBeenCalledTimes(1);
  act(() => jest.advanceTimersByTime(579)); expect(step).toHaveBeenCalledTimes(1);
  act(() => jest.advanceTimersByTime(1)); expect(step).toHaveBeenCalledTimes(2);
  act(() => jest.advanceTimersByTime(80)); expect(step).toHaveBeenCalledTimes(3);
  act(() => surface().props.onResponderRelease());
  act(() => jest.advanceTimersByTime(800)); expect(step).toHaveBeenCalledTimes(3);
  expect(step).toHaveBeenLastCalledWith(1);
});
test('disabled, cancelled and multi-touch holds stop repeating', () => {
  const step = jest.fn(); mount(step, false);
  act(() => surface().props.onResponderGrant(event())); expect(step).not.toHaveBeenCalled();
  act(() => view.update(<TimeStepButton direction={1} interval="1 day" enabled onStep={step} />));
  act(() => surface().props.onResponderGrant(event()));
  act(() => surface().props.onResponderStart(event(2)));
  act(() => jest.advanceTimersByTime(800)); expect(step).toHaveBeenCalledTimes(1);
  act(() => surface().props.onResponderGrant(event()));
  act(() => surface().props.onResponderTerminate());
  act(() => jest.advanceTimersByTime(800)); expect(step).toHaveBeenCalledTimes(2);
  act(() => surface().props.onResponderGrant(event()));
  act(() => view.update(<TimeStepButton direction={1} interval="1 day" enabled={false} onStep={step} />));
  act(() => jest.advanceTimersByTime(800)); expect(step).toHaveBeenCalledTimes(3);
});
test('accessibility activates once; target unmount and app background cancel holds', () => {
  let background!: (state: AppStateStatus) => void;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_name, cb) => { background = cb; return { remove: jest.fn() }; });
  const step = jest.fn(); mount(step);
  act(() => surface().props.onAccessibilityTap()); expect(step).toHaveBeenCalledTimes(1);
  act(() => surface().props.onResponderGrant(event()));
  act(() => background('background'));
  act(() => jest.advanceTimersByTime(800)); expect(step).toHaveBeenCalledTimes(2);
  act(() => surface().props.onResponderGrant(event()));
  act(() => view.unmount());
  act(() => jest.advanceTimersByTime(800)); expect(step).toHaveBeenCalledTimes(3);
});
