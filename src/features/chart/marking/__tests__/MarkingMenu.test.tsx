import { AddChartButton } from '../../active/AddChartButton';
import { useActionRegistry } from '../../actions/useActionRegistry';
import { context as actionContext } from '../../actions/testContext';
import { useState } from 'react';
import { ChartSheet } from '../../components/ChartSheet';
import { Modal } from 'react-native';
import { act, create } from 'react-test-renderer';
import { AppState, Text, View, type AppStateStatus } from 'react-native';
import { MarkingMenuProvider, MarkingMenuButton } from '../MarkingMenu';
jest.mock('../MarkingIcon', () => ({ MarkingIcon: 'MarkingIcon' }));
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
const touch = (pageX = 100, pageY = 100, count = 1) => ({ nativeEvent: { pageX, pageY, locationX: 22, locationY: 22, touches: Array.from({ length: count }, () => ({ pageX, pageY })) } });
const button = () => view.root.findAll(n => n.type === View && n.props.testID === 'marking-test')[0];
const overlays = () => view.root.findAll(n => n.type === View && n.props.testID === 'marking-menu-overlay');
test('touch grant and release with no movement runs the primary action exactly once', async () => {
  const action = jest.fn();
  await act(async () => { view = create(<Probe action={action} />); });
  expect(button().props.onStartShouldSetResponder()).toBe(true);
  act(() => button().props.onResponderGrant(touch()));
  expect(action).not.toHaveBeenCalled();
  act(() => jest.advanceTimersByTime(50));
  act(() => button().props.onResponderRelease(touch(100, 100, 0)));
  expect(action).toHaveBeenCalledTimes(1);
  act(() => jest.runAllTimers());
  expect(overlays()).toHaveLength(0);
  act(() => button().props.onAccessibilityTap());
  expect(action).toHaveBeenCalledTimes(2);
  act(() => view.update(<Probe action={action} disabled />));
  expect(button().props.onStartShouldSetResponder()).toBe(false);
  act(() => button().props.onAccessibilityTap());
  expect(action).toHaveBeenCalledTimes(2);
});
test('a held stationary touch reveals the menu but does not run a tap on release', async () => {
  const action = jest.fn();
  await act(async () => { view = create(<Probe action={action} />); });
  act(() => button().props.onResponderGrant(touch()));
  act(() => jest.advanceTimersByTime(100));
  expect(overlays()).toHaveLength(1);
  act(() => jest.advanceTimersByTime(200));
  act(() => button().props.onResponderRelease(touch(100, 100, 0)));
  expect(overlays()).toHaveLength(0);
  expect(action).not.toHaveBeenCalled();
});
test('route disable cancels a menu and ignores a queued release', async () => {
  const action = jest.fn();
  await act(async () => { view = create(<Probe action={action} />); });
  act(() => button().props.onResponderGrant(touch()));
  const release = button().props.onResponderRelease;
  act(() => jest.advanceTimersByTime(100));
  expect(overlays()).toHaveLength(1);
  act(() => view.update(<Probe enabled={false} action={action} />));
  expect(overlays()).toHaveLength(0);
  act(() => release(touch(100, 100, 0)));
  expect(action).not.toHaveBeenCalled();
});
test('app background and responder termination cancel without an action', async () => {
  let onState: (state: AppStateStatus) => void = () => {};
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, cb) => { onState = cb; return { remove: jest.fn() }; });
  const action = jest.fn();
  await act(async () => { view = create(<Probe action={action} />); });
  act(() => button().props.onResponderGrant(touch()));
  act(() => onState('background'));
  act(() => button().props.onResponderRelease(touch(100, 100, 0)));
  act(() => button().props.onResponderGrant(touch()));
  act(() => button().props.onResponderTerminate());
  act(() => jest.advanceTimersByTime(200));
  expect(action).not.toHaveBeenCalled();
  expect(overlays()).toHaveLength(0);
});
test('dragging back to the center and adding a second finger never become taps', async () => {
  const action = jest.fn();
  await act(async () => { view = create(<Probe action={action} />); });
  act(() => button().props.onResponderGrant(touch()));
  act(() => button().props.onResponderMove(touch(145)));
  expect(overlays()).toHaveLength(1);
  act(() => button().props.onResponderRelease(touch(100, 100, 0)));
  expect(action).not.toHaveBeenCalled();
  act(() => button().props.onResponderGrant(touch()));
  act(() => button().props.onResponderStart(touch(100, 100, 2)));
  act(() => button().props.onResponderRelease(touch(100, 100, 0)));
  expect(action).not.toHaveBeenCalled();
});

test('a completed sheet swipe releases its host and permits an immediate toolbar tap', async () => {
  const opened = jest.fn();
  function SheetProbe() {
    const [visible, setVisible] = useState(false);
    return <MarkingMenuProvider enabled={!visible}>
      <MarkingMenuButton id="test" label="Display" onPress={() => { opened(); setVisible(true); }}><Text>Display</Text></MarkingMenuButton>
      <ChartSheet visible={visible} onClose={() => setVisible(false)}><Text>Sheet</Text></ChartSheet>
    </MarkingMenuProvider>;
  }
  await act(async () => { view = create(<SheetProbe />); });
  for (let i = 1; i <= 3; i++) {
    expect(button().props.onStartShouldSetResponder()).toBe(true);
    act(() => button().props.onResponderGrant(touch()));
    act(() => button().props.onResponderRelease(touch(100, 100, 0)));
    expect(opened).toHaveBeenCalledTimes(i);
    expect(button().props.onStartShouldSetResponder()).toBe(false);
    const modal = () => view.root.findByType(Modal).props;
    act(() => modal().onShow());
    act(() => modal().onRequestClose());
    expect(view.root.findAllByType(Modal)).toHaveLength(0);
    // Intentionally do not advance any timers or deliver a second onDismiss.
    expect(button().props.onStartShouldSetResponder()).toBe(true);
  }
});

test('Add Chart taps open the library; dragging south adds Now exactly once', async () => {
  const c = actionContext();
  function AddProbe({ expanded = false }: { expanded?: boolean }) {
    const actions = useActionRegistry(c);
    return <MarkingMenuProvider><AddChartButton actions={actions} expanded={expanded} /></MarkingMenuProvider>;
  }
  await act(async () => { view = create(<AddProbe />); });
  const add = () => view.root.findAll(n => n.type === View && n.props.testID === 'marking-add-chart')[0];
  act(() => add().props.onResponderGrant(touch()));
  await act(async () => add().props.onResponderRelease(touch(100, 100, 0)));
  expect(c.openLibrary).toHaveBeenCalledTimes(1); expect(c.addNow).not.toHaveBeenCalled();
  act(() => add().props.onResponderGrant(touch()));
  act(() => jest.advanceTimersByTime(100));
  act(() => add().props.onResponderMove(touch(100, 200)));
  await act(async () => add().props.onResponderRelease(touch(100, 200, 0)));
  expect(c.addNow).toHaveBeenCalledTimes(1); expect(c.openLibrary).toHaveBeenCalledTimes(1);
  expect(overlays()).toHaveLength(0);
  // The wide empty-state button anchors the menu near the touch, keeping south directly below.
  act(() => view.update(<AddProbe expanded />));
  act(() => add().props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 320, height: 44 } } }));
  act(() => add().props.onResponderGrant(touch()));
  act(() => jest.advanceTimersByTime(100));
  const overlay = overlays()[0];
  expect(overlay.findAll(n => n.type === View && n.props.style?.left === 0 && n.props.style?.width === 200).length).toBeGreaterThan(0);
  act(() => add().props.onResponderTerminate());
  expect(c.addNow).toHaveBeenCalledTimes(1);
  await act(async () => add().props.onAccessibilityAction({ nativeEvent: { actionName: 's:chart.addNow' } }));
  expect(c.addNow).toHaveBeenCalledTimes(2);
});
