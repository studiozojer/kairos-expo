import React from 'react';
import { Mask, Rect, AlphaType, ColorType } from '@shopify/react-native-skia';
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
  // Skia clips the mask with one content pass, then paints a second pass.
  expect(view.root.findAllByType(EventSymbol)).toHaveLength(4);
  const preview: EventTimelineProps = { ...stepped, slots: [{ ...origin, id: 'preview' }, origin, entry, null, null] };
  act(() => view.update(<EventTimeline {...preview} />));
  expect(view.root.findAllByType(EventSymbol)).toHaveLength(4);
  act(() => jest.advanceTimersByTime(349));
  expect(view.root.findAllByType(EventSymbol)).toHaveLength(4);
  act(() => jest.advanceTimersByTime(1));
  expect(view.root.findAllByType(EventSymbol)).toHaveLength(6);
  expect(mockSpring).toHaveBeenCalledTimes(1);
  act(() => view.unmount()); jest.useRealTimers();
});

test('edge mask leaves empty space transparent and preserves content color', async () => {
  const { drawAsImage } = jest.requireActual('@shopify/react-native-skia/src/renderer/Offscreen');
  let view!: ReturnType<typeof create>;
  act(() => { view = create(<EventTimeline {...props} />); });
  act(() => { view.root.findByProps({ testID: 'event-symbol-timeline' }).props.onLayout({ nativeEvent: { layout: { width: 220 } } }); });
  const mask = view.root.findByType(Mask);
  // An opaque mask isolates clipping from gradient interpolation (covered by fade-stop tests).
  const image = await drawAsImage(<Mask {...mask.props} mask={<Rect x={0} y={0} width={220} height={44} color="black" />}><Rect x={0} y={10} width={220} height={10} color="#ff0000" /></Mask>, { width: 220, height: 44 });
  const pixels = image.readPixels(0, 0, { width: 220, height: 44, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Unpremul });
  const alpha = (x: number, y: number) => pixels[(y * 220 + x) * 4 + 3];
  expect(alpha(110, 30)).toBe(0); // Empty center must not become an opaque black panel.
  expect(alpha(8, 30)).toBe(0);
  expect(alpha(110, 15)).toBe(255);
  expect(pixels[(15 * 220 + 110) * 4]).toBe(255);
  image.dispose();
  act(() => view.unmount());
});
