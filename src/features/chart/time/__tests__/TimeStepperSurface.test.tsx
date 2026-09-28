import { Platform, View } from 'react-native';
import { act, create } from 'react-test-renderer';
import { BlurView } from 'expo-blur';
import { TimeStepperSurface } from '../TimeStepperSurface';
jest.mock('expo-blur', () => ({ BlurView: 'BlurView' }));
test('iOS uses the Swift ultra-thin material and retains its children', () => {
  const original = Platform.OS; Platform.OS = 'ios';
  let view!: ReturnType<typeof create>;
  try {
    act(() => { view = create(<TimeStepperSurface><View testID="child" /></TimeStepperSurface>); });
    expect(view.root.findByType(BlurView).props.tint).toMatch(/^systemUltraThinMaterial/);
    expect(view.root.findByType(BlurView).props.style.borderRadius).toBe(32);
    expect(view.root.findAll(n => n.props.testID === "child").length).toBeGreaterThan(0);
  } finally { act(() => view.unmount()); Platform.OS = original; }
});
