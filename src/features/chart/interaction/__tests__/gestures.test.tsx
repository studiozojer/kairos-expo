import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Gesture, type GestureTouchEvent } from 'react-native-gesture-handler';
import { useChartGesture } from '../useChartGesture';
import type { ChartTarget } from '../selection';

// Run the real gesture callbacks with deterministic shared values. These tests
// cover our wiring, not native recognizer arbitration or device frame pacing.
jest.mock('expo-router', () => ({ useFocusEffect: () => {} }));
jest.mock('react-native-reanimated', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    useSharedValue: (initial: unknown) => React.useRef({ value: initial }).current,
    useDerivedValue: (calculate: () => unknown) => ({ get value() { return calculate(); } }),
    useFrameCallback: () => {},
    runOnUI: (fn: unknown) => fn, runOnJS: (fn: unknown) => fn,
    cancelAnimation: () => {}, withSpring: (value: number) => value,
  };
});
let motion: ReturnType<typeof useChartGesture>;
let view: ReactTestRenderer;
const tap = jest.fn(), hold = jest.fn();
const targets: ChartTarget[] = [{ id: 'sun', kind: 'body', label: 'Sun', detail: '', x: 120, y: 200, radius: 20 }];
function Probe({ enabled = true }: { enabled?: boolean }) {
  const result = useChartGesture(400, targets, enabled, tap, hold);
  React.useEffect(() => { motion = result; }); return null;
}
const manager = { handlerTag: 0, begin: jest.fn(), activate: jest.fn(), end: jest.fn(), fail: jest.fn() };
function touches(points: { id: number; x: number; y: number }[], changed = points): GestureTouchEvent {
  return { numberOfTouches: points.length, allTouches: points, changedTouches: changed } as GestureTouchEvent;
}
function transform() {
  const values = motion.animatedTransform.value;
  return { x: (values[0] as { translateX: number }).translateX - 200,
    y: (values[1] as { translateY: number }).translateY - 200,
    scale: (values[2] as { scale: number }).scale };
}
beforeEach(async () => {
  jest.clearAllMocks();
  await act(async () => { view = create(<Probe />); });
});
afterEach(() => act(() => view.unmount()));
test('double empty tap zooms and resets; body taps never zoom', () => {
  const handlers = (motion.gesture.toGestureArray()[2] as ReturnType<typeof Gesture.Tap>).handlers;
  const event = { x: 200, y: 200 } as Parameters<NonNullable<typeof handlers.onEnd>>[0];
  act(() => { handlers.onEnd!(event, true); handlers.onEnd!(event, true); });
  expect(transform().scale).toBe(2);
  act(() => { handlers.onEnd!(event, true); handlers.onEnd!(event, true); });
  expect(transform().scale).toBe(1);
  act(() => { handlers.onEnd!({ ...event, x: 120 }, true); handlers.onEnd!({ ...event, x: 120 }, true); });
  expect(transform().scale).toBe(1);
  expect(tap).toHaveBeenLastCalledWith('sun');
});
test('one-finger drag at 1x stays still; adding a finger pinches and lifting it continues pan', () => {
  const h = (motion.gesture.toGestureArray()[0] as ReturnType<typeof Gesture.Manual>).handlers;
  act(() => {
    h.onTouchesDown!(touches([{ id: 1, x: 120, y: 200 }]), manager);
    h.onTouchesMove!(touches([{ id: 1, x: 150, y: 200 }]), manager);
  });
  expect(manager.activate).not.toHaveBeenCalled();
  expect(transform().scale).toBe(1);
  act(() => {
    h.onTouchesDown!(touches([{ id: 1, x: 150, y: 200 }, { id: 2, x: 250, y: 200 }]), manager);
    h.onTouchesMove!(touches([{ id: 1, x: 100, y: 200 }, { id: 2, x: 300, y: 200 }]), manager);
  });
  expect(manager.activate).toHaveBeenCalled();
  expect(transform().scale).toBe(2);
  act(() => h.onTouchesUp!(touches([{ id: 2, x: 300, y: 200 }], [{ id: 1, x: 100, y: 200 }]), manager));
  expect(transform().x).toBe(0);
  act(() => h.onTouchesMove!(touches([{ id: 2, x: 320, y: 210 }]), manager));
  expect(transform()).toEqual({ scale: 2, x: 20, y: 10 });
});
test('cancel returns overscroll inside bounds and disabling blocks tap actions', async () => {
  const h = (motion.gesture.toGestureArray()[0] as ReturnType<typeof Gesture.Manual>).handlers;
  act(() => {
    motion.zoom(1);
    h.onTouchesDown!(touches([{ id: 1, x: 200, y: 200 }]), manager);
    h.onTouchesMove!(touches([{ id: 1, x: 700, y: 200 }]), manager);
  });
  expect(transform().x).toBeGreaterThan(100);
  act(() => h.onTouchesCancelled!(touches([]), manager));
  expect(transform().x).toBe(100);
  await act(async () => view.update(<Probe enabled={false} />));
  const end = (motion.gesture.toGestureArray()[2] as ReturnType<typeof Gesture.Tap>).handlers.onEnd!;
  act(() => end({ x: 200, y: 200 } as never, true));
  expect(tap).not.toHaveBeenCalled();
});
