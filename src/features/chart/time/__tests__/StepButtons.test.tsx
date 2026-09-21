import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { StepButtons } from '../StepButtons';

let view: ReactTestRenderer;
beforeEach(() => jest.useFakeTimers());
afterEach(() => { act(() => view?.unmount()); jest.useRealTimers(); });
const event = (x: number, y = 22, count = 1) => ({ nativeEvent: { locationX: x, locationY: y, touches: Array(count).fill({}) } });
const surface = () => view.root.findAll(node => node.props.testID === 'step-buttons-touch')[0];
function mount(step: jest.Mock, canForward = true) {
  act(() => { view = create(<StepButtons interval="1 day" canBackward canForward={canForward} onStep={step} />); });
}

test('held touch switches direction immediately and keeps repeating without a second hold delay', () => {
  const step = jest.fn(); mount(step);
  act(() => surface().props.onResponderGrant(event(22)));
  expect(step.mock.calls).toEqual([[-1]]);
  act(() => jest.advanceTimersByTime(580));
  expect(step.mock.calls).toEqual([[-1], [-1], [-1]]);
  act(() => surface().props.onResponderMove(event(74)));
  expect(step).toHaveBeenLastCalledWith(1);
  const switched = step.mock.calls.length;
  act(() => jest.advanceTimersByTime(80));
  expect(step).toHaveBeenCalledTimes(switched + 1);
  expect(step).toHaveBeenLastCalledWith(1);
  act(() => surface().props.onResponderRelease());
  act(() => jest.advanceTimersByTime(1000));
  expect(step).toHaveBeenCalledTimes(switched + 1);
});

test('gap and outside bounds pause repetition; reentry resumes and cancellation stops', () => {
  const step = jest.fn(); mount(step);
  act(() => surface().props.onResponderGrant(event(22)));
  act(() => surface().props.onResponderMove(event(48)));
  act(() => jest.advanceTimersByTime(700));
  expect(step).toHaveBeenCalledTimes(1);
  act(() => surface().props.onResponderMove(event(74)));
  expect(step).toHaveBeenLastCalledWith(1);
  act(() => surface().props.onResponderMove(event(74, 60)));
  act(() => jest.advanceTimersByTime(700));
  expect(step).toHaveBeenCalledTimes(2);
  act(() => surface().props.onResponderMove(event(22)));
  act(() => surface().props.onResponderTerminate());
  act(() => jest.advanceTimersByTime(700));
  expect(step).toHaveBeenCalledTimes(3);
});

test('disabled directions cannot fire and disabling the active direction stops its timer', () => {
  const step = jest.fn(); mount(step, false);
  act(() => surface().props.onResponderGrant(event(74)));
  act(() => jest.advanceTimersByTime(600));
  expect(step).not.toHaveBeenCalled();
  act(() => surface().props.onResponderMove(event(22)));
  expect(step).toHaveBeenCalledTimes(1);
  act(() => view.update(<StepButtons interval="1 day" canBackward={false} canForward={false} onStep={step} />));
  act(() => jest.advanceTimersByTime(600));
  expect(step).toHaveBeenCalledTimes(1);
});

test('a tap steps once, assistive activation works, and unmount cancels held repetition', () => {
  const step = jest.fn(); mount(step);
  act(() => { surface().props.onResponderGrant(event(74)); surface().props.onResponderRelease(); });
  act(() => jest.advanceTimersByTime(600));
  expect(step).toHaveBeenCalledTimes(1);
  const button = view.root.findAll(node => node.props.accessibilityLabel === 'Step backward 1 day' && node.props.onPress)[0];
  act(() => button.props.onPress());
  expect(step).toHaveBeenLastCalledWith(-1);
  act(() => surface().props.onResponderGrant(event(22)));
  act(() => view.unmount());
  act(() => jest.advanceTimersByTime(600));
  expect(step).toHaveBeenCalledTimes(3);
});

test('adding a second touch cancels the hold', () => {
  const step = jest.fn(); mount(step);
  act(() => surface().props.onResponderGrant(event(22)));
  act(() => surface().props.onResponderStart(event(74, 22, 2)));
  act(() => jest.advanceTimersByTime(700));
  expect(step).toHaveBeenCalledTimes(1);
});
