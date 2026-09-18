import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { RepeatButton } from '../TimeStepper';

jest.mock('expo-router/unstable-native-tabs', () => ({ NativeTabs: { BottomAccessory: { usePlacement: () => 'regular' } } }));
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
