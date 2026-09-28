import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { Canvas, Path } from '@shopify/react-native-skia';
import Animated, { useAnimatedStyle, withTiming, ReduceMotion } from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { stepperHaptic } from './stepperHaptics';

export function TimeStepButton({ direction, enabled, interval, onStep }: {
  direction: -1 | 1; enabled: boolean; interval: string; onStep: (direction: -1 | 1) => void;
}) {
  const t = useTheme();
  const latest = useRef({ enabled, onStep, direction });
  const held = useRef(false), timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [pressed, setPressed] = useState(false);
  const end = useCallback(() => { held.current = false; clearTimeout(timer.current); setPressed(false); }, []);
  // Disabling during a held press must clear both the timer and its visual state.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useLayoutEffect(() => { latest.current = { enabled, onStep, direction }; if (!enabled) end(); }, [enabled, onStep, direction, end]);
  useEffect(() => {
    const app = AppState.addEventListener('change', state => { if (state !== 'active') end(); });
    return () => { latest.current.enabled = false; held.current = false; clearTimeout(timer.current); app.remove(); };
  }, [end]);
  const step = () => { if (latest.current.enabled) { latest.current.onStep(latest.current.direction); stepperHaptic(); } };
  const begin = () => {
    if (!latest.current.enabled || held.current) return;
    held.current = true; setPressed(true); step();
    const repeat = () => {
      if (!held.current || !latest.current.enabled) return;
      step(); timer.current = setTimeout(repeat, 80);
    };
    // Swift starts the repeating 80ms timer after its 500ms ramp-up.
    timer.current = setTimeout(repeat, 580);
  };
  const style = useAnimatedStyle(() => ({
    opacity: withTiming(pressed && enabled ? .6 : 1, { duration: 100, reduceMotion: ReduceMotion.System }),
    transform: [{ scale: withTiming(pressed && enabled ? .95 : 1, { duration: 100, reduceMotion: ReduceMotion.System }) }],
  }));
  return <Animated.View testID={`time-step-${direction}`} accessible accessibilityRole="button"
    accessibilityLabel={`Step ${direction === -1 ? 'backward' : 'forward'} ${interval}`}
    accessibilityHint="Hold to keep stepping" accessibilityState={{ disabled: !enabled }}
    onAccessibilityTap={step} accessibilityActions={[{ name: 'activate' }]}
    onAccessibilityAction={({ nativeEvent }) => { if (nativeEvent.actionName === 'activate') step(); }}
    onStartShouldSetResponder={() => latest.current.enabled}
    onResponderGrant={event => { if (event.nativeEvent.touches.length === 1) begin(); }}
    onResponderStart={event => { if (event.nativeEvent.touches.length !== 1) end(); }}
    onResponderRelease={end} onResponderTerminate={end} onResponderTerminationRequest={() => true}
    style={[{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: t.color.bgPrimary }, style]}>
    <Canvas pointerEvents="none" style={{ width: 16, height: 16 }}>
      <Path path={direction === -1 ? 'M10 2L4 8L10 14' : 'M6 2L12 8L6 14'} style="stroke" strokeWidth={2.2} strokeCap="round" strokeJoin="round" color={enabled ? t.color.icPrimary : t.color.icTertiary} />
    </Canvas>
  </Animated.View>;
}
