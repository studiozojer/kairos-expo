import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { IntervalDial, TimeStepper } from '../TimeStepper';

const mockClock = {
  time: 0, origin: 0, unit: 2, status: 'ready', reset: jest.fn(), retry: jest.fn(),
  selectUnit: jest.fn(), step: jest.fn(), canStepBackward: true, canStepForward: true,
};
jest.mock('../ChartTimeContext', () => ({ useChartTime: () => mockClock }));
let view: ReactTestRenderer;
beforeEach(() => jest.useFakeTimers());
afterEach(() => { if (view) act(() => view.unmount()); jest.useRealTimers(); });

test('dial keeps selecting through a paused drag and ignores programmatic scrolls', () => {
  const change = jest.fn();
  const reset = jest.fn();
  const tap = jest.fn();
  act(() => { view = create(<IntervalDial unit={2} onChange={change} onTap={tap}
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
  act(() => dial().props.onTouchEnd());
  expect(tap).not.toHaveBeenCalled();
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
  const surface = () => view.root.findAll(node => node.props.testID === 'time-interval-dial')[0];
  const dial = () => view.root.findByType(IntervalDial);
  act(() => surface().props.onTouchEnd());
  expect(mockClock.reset).not.toHaveBeenCalled();
  act(() => { jest.advanceTimersByTime(100); surface().props.onTouchEnd(); });
  expect(mockClock.reset).toHaveBeenCalledTimes(1);
  act(() => { surface().props.onTouchEnd(); dial().props.onScrollStart(); surface().props.onTouchEnd(); });
  expect(mockClock.reset).toHaveBeenCalledTimes(1);
  act(() => { dial().props.onChange(3); surface().props.onTouchEnd(); });
  expect(mockClock.reset).toHaveBeenCalledTimes(1);
  act(() => dial().props.onTap());
  expect(mockClock.reset).toHaveBeenCalledTimes(2);
});


test('loading keeps the time offset without flashing status text', () => {
  mockClock.status = 'loading';
  act(() => { view = create(<TimeStepper />); });
  expect(JSON.stringify(view.toJSON())).not.toContain('Updating');
  expect(view.root.findByType(IntervalDial).props.offset).toBe('Now');
  mockClock.status = 'ready';
});
