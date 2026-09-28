import React from 'react';
import { act, create } from 'react-test-renderer';
import { AppState, type AppStateStatus } from 'react-native';
import { EventTimeline, type EventTimelineProps } from '../EventTimeline';
import { CHART_COLORS_DEFAULT } from '../../schema/core-types';
import { ASPECT_HUES_DEFAULT } from '../../schema/ring-styles';

let mockReducedMotion = false;
let mockOffset: { value: number };
const mockSpring = jest.fn((..._args: unknown[]) => 0);
const mockCancel = jest.fn();
jest.mock('react-native-reanimated', () => ({
  useSharedValue: (value: number) => {
    const ref = jest.requireActual('react').useRef({ value }); mockOffset = ref.current; return ref.current;
  },
  useDerivedValue: (compute: () => unknown) => ({ value: compute() }),
  useReducedMotion: () => mockReducedMotion,
  runOnUI: (fn: () => void) => fn,
  cancelAnimation: (...args: unknown[]) => mockCancel(...args),
  withSpring: (...args: unknown[]) => mockSpring(...args),
  ReduceMotion: { System: 'system' },
}));
const props: EventTimelineProps = {
  slots: [null, null, { id: 'origin', kind: 'origin', time: 0 }, null, null],
  transition: { sequence: 0, direction: 0 }, loading: false, timezone: 'UTC',
  colors: CHART_COLORS_DEFAULT, aspectHues: ASPECT_HUES_DEFAULT, enabled: true,
};
afterEach(() => { jest.restoreAllMocks(); mockSpring.mockClear(); mockCancel.mockClear(); mockReducedMotion = false; });
test('data arrival at the same transition never restarts travel; settlement cancels immediately', () => {
  let view!: ReturnType<typeof create>;
  act(() => { view = create(<EventTimeline {...props} />); });
  expect(mockSpring).not.toHaveBeenCalled();
  act(() => { view.update(<EventTimeline {...props} transition={{ sequence: 1, direction: 1 }} />); });
  expect(mockSpring).toHaveBeenCalledTimes(1);
  expect(mockSpring).toHaveBeenCalledWith(0, { duration: 280, dampingRatio: .82, reduceMotion: 'system' });
  act(() => { view.update(<EventTimeline {...props} slots={[null, { id: 'entry', kind: 'entry', time: 1 }, props.slots[2], null, null]} transition={{ sequence: 1, direction: 1 }} />); });
  expect(mockSpring).toHaveBeenCalledTimes(1);
  mockOffset.value = 22;
  act(() => { view.update(<EventTimeline {...props} transition={{ sequence: 2, direction: 0 }} />); });
  expect(mockOffset.value).toBe(0); expect(mockSpring).toHaveBeenCalledTimes(1);
  act(() => view.unmount());
});
test('reduced motion, disabling and background all stop travel inside the original footprint', () => {
  let background!: (state: AppStateStatus) => void;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_name, fn) => { background = fn; return { remove: jest.fn() }; });
  mockReducedMotion = true;
  let view!: ReturnType<typeof create>;
  act(() => { view = create(<EventTimeline {...props} />); });
  act(() => { view.update(<EventTimeline {...props} transition={{ sequence: 1, direction: -1 }} />); });
  expect(mockSpring).not.toHaveBeenCalled();
  const root = view.root.findByProps({ testID: 'event-symbol-timeline' });
  expect(root.props.style.height).toBe(44);
  expect(root.props.accessibilityElementsHidden).toBe(true);
  expect(root.props.pointerEvents).toBe('none');
  mockOffset.value = 35; act(() => background('background')); expect(mockOffset.value).toBe(0);
  mockOffset.value = -35;
  act(() => view.update(<EventTimeline {...props} enabled={false} />));
  expect(mockOffset.value).toBe(0);
  act(() => view.unmount());
});

test('preview slots wait for the 350ms settlement without restarting the spring', () => {
  jest.useFakeTimers();
  const { EventSymbol } = jest.requireActual('../EventSymbol') as typeof import('../EventSymbol');
  const origin = { id: 'origin', kind: 'origin' as const, time: 0 };
  const entry = { id: 'entry', kind: 'entry' as const, time: 1 };
  let view!: ReturnType<typeof create>;
  act(() => { view = create(<EventTimeline {...props} />); });
  act(() => { view.root.findByProps({ testID: 'event-symbol-timeline' }).props.onLayout({ nativeEvent: { layout: { width: 220 } } }); });
  const stepped: EventTimelineProps = { ...props, slots: [null, origin, entry, null, null], transition: { sequence: 1, direction: 1 } };
  act(() => view.update(<EventTimeline {...stepped} />));
  expect(view.root.findAllByType(EventSymbol)).toHaveLength(2);
  const preview: EventTimelineProps = { ...stepped, slots: [{ ...origin, id: 'preview' }, origin, entry, null, null] };
  act(() => view.update(<EventTimeline {...preview} />));
  expect(view.root.findAllByType(EventSymbol)).toHaveLength(2);
  act(() => jest.advanceTimersByTime(349));
  expect(view.root.findAllByType(EventSymbol)).toHaveLength(2);
  act(() => jest.advanceTimersByTime(1));
  expect(view.root.findAllByType(EventSymbol)).toHaveLength(3);
  expect(mockSpring).toHaveBeenCalledTimes(1);
  act(() => view.unmount()); jest.useRealTimers();
});
