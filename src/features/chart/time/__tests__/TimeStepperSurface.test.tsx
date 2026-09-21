import React from 'react';
import { Platform, Pressable, View } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { GlassView, isGlassEffectAPIAvailable, isLiquidGlassAvailable } from 'expo-glass-effect';
import { TimeStepperSurface } from '../TimeStepperSurface';

jest.mock('expo-glass-effect', () => ({
  GlassView: require('react-native').View,
  isGlassEffectAPIAvailable: jest.fn(),
  isLiquidGlassAvailable: jest.fn(),
}));

let view: ReactTestRenderer;
const originalOS = Platform.OS;
afterEach(() => { act(() => view?.unmount()); Platform.OS = originalOS; });

test('native glass has no opaque background and leaves child actions enabled', () => {
  Platform.OS = 'ios';
  jest.mocked(isGlassEffectAPIAvailable).mockReturnValue(true);
  jest.mocked(isLiquidGlassAvailable).mockReturnValue(true);
  const press = jest.fn();
  act(() => { view = create(<TimeStepperSurface><Pressable onPress={press} /></TimeStepperSurface>); });
  const glass = view.root.findByType(GlassView);
  expect(glass.props.isInteractive).toBe(false);
  expect(glass.props.style.backgroundColor).toBeUndefined();
  act(() => view.root.findAll(node => node.props.onPress === press)[0].props.onPress());
  expect(press).toHaveBeenCalledTimes(1);
});

test.each(['android', 'ios'] as const)('uses the opaque fallback when glass is unavailable on %s', os => {
  Platform.OS = os;
  jest.mocked(isGlassEffectAPIAvailable).mockReturnValue(false);
  act(() => { view = create(<TimeStepperSurface><Pressable /></TimeStepperSurface>); });
  const surface = view.root.findAllByType(View)[0];
  expect(surface.props.glassEffectStyle).toBeUndefined();
  expect(surface.props.style.backgroundColor).toBeDefined();
});
