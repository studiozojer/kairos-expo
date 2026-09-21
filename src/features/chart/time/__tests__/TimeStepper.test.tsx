import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { IntervalDial, RepeatButton, TimeStepper } from '../TimeStepper';

jest.mock('expo-router/unstable-native-tabs', () => ({ NativeTabs: { BottomAccessory: { usePlacement: () => 'regular' } } }));
const mockClock = {
  time: 0, origin: 0, unit: 2, status: 'ready', reset: jest.fn(), retry: jest.fn(),
  selectUnit: jest.fn(), step: jest.fn(), canStepBackward: true, canStepForward: true,
};
jest.mock('../ChartTimeContext', () => ({ useChartTime: () => mockClock }));
let view: ReactTestRenderer;
beforeEach(() => jest.useFakeTimers());
afterEach(() => { if (view) act(() => view.unmount()); jest.useRealTimers(); });

test('hold repeats, release stops, and a tap never fires twice', () => {
  const step = jest.fn();
  act(() => { view = create(<RepeatButton label="Forward" glyph="›" disabled={false} onStep={step} />); });
  const button = () => view.root.findAll(node => node.props.accessibilityLabel === 'Forward' && typeof node.props.onPressIn === 'function')[0];
  act(() => button().props.onPressIn());
  expect(step).toHaveBeenCalledTimes(1);
  act(() => jest.advanceTimersByTime(580));
  expect(step).toHaveBeenCalledTimes(3);
  act(() => { button().props.onPressOut(); button().props.onPress(); });
  act(() => jest.advanceTimersByTime(1000));
  expect(step).toHaveBeenCalledTimes(3);
  act(() => { button().props.onPressIn(); button().props.onPressOut(); button().props.onPress(); });
  expect(step).toHaveBeenCalledTimes(4);
});

test('disable and unmount cancel repetition; assistive activation works without press-in', () => {
  const step = jest.fn();
  act(() => { view = create(<RepeatButton label="Forward" glyph="›" disabled={false} onStep={step} />); });
  act(() => view.root.findAll(node => node.props.accessibilityLabel === 'Forward' && typeof node.props.onPressIn === 'function')[0].props.onPress());
  expect(step).toHaveBeenCalledTimes(1);
  act(() => view.root.findAll(node => node.props.accessibilityLabel === 'Forward' && typeof node.props.onPressIn === 'function')[0].props.onPressIn());
  act(() => { view.update(<RepeatButton label="Forward" glyph="›" disabled onStep={step} />); });
  act(() => jest.advanceTimersByTime(1000));
  expect(step).toHaveBeenCalledTimes(2);
  act(() => { view.update(<RepeatButton label="Forward" glyph="›" disabled={false} onStep={step} />); });
  act(() => view.root.findAll(node => node.props.accessibilityLabel === 'Forward' && typeof node.props.onPressIn === 'function')[0].props.onPressIn());
  act(() => view.unmount());
  act(() => jest.advanceTimersByTime(1000));
  expect(step).toHaveBeenCalledTimes(3);
});


test('dial keeps selecting through a paused drag and ignores programmatic scrolls', () => {
  const change = jest.fn();
  const reset = jest.fn();
  act(() => { view = create(<IntervalDial unit={2} onChange={change} onTap={jest.fn()}
    onReset={reset} onScrollStart={jest.fn()} />); });
  const dial = () => view.root.findAll(node => node.props.testID === 'time-interval-dial')[0];
  const scroll = (y: number) => dial().props.onScroll({ nativeEvent: { contentOffset: { y } } });
  act(() => scroll(48));
  expect(change).not.toHaveBeenCalled();
  act(() => { dial().props.onScrollBeginDrag(); scroll(72); });
  expect(change).toHaveBeenLastCalledWith(3);
  act(() => jest.advanceTimersByTime(1000));
  act(() => scroll(120));
  expect(change).toHaveBeenLastCalledWith(5);
  act(() => { dial().props.onScrollEndDrag(); dial().props.onMomentumScrollEnd(); });
  change.mockClear();
  act(() => scroll(48));
  expect(change).not.toHaveBeenCalled();
  act(() => dial().props.onAccessibilityAction({ nativeEvent: { actionName: 'reset' } }));
  expect(reset).toHaveBeenCalledTimes(1);
});

test('double-tap returns to now; dragging or changing intervals cancels a pending tap', () => {
  mockClock.reset.mockClear();
  act(() => { view = create(<TimeStepper />); });
  const offset = () => view.root.findAll(node => node.props.accessibilityLabel === 'Chart time: Now')[0];
  const dial = () => view.root.findByType(IntervalDial);
  act(() => offset().props.onPress());
  expect(mockClock.reset).not.toHaveBeenCalled();
  act(() => { jest.advanceTimersByTime(100); offset().props.onPress(); });
  expect(mockClock.reset).toHaveBeenCalledTimes(1);
  act(() => { offset().props.onPress(); dial().props.onScrollStart(); offset().props.onPress(); });
  expect(mockClock.reset).toHaveBeenCalledTimes(1);
  act(() => { dial().props.onChange(3); offset().props.onPress(); });
  expect(mockClock.reset).toHaveBeenCalledTimes(1);
  act(() => dial().props.onTap());
  expect(mockClock.reset).toHaveBeenCalledTimes(2);
});
