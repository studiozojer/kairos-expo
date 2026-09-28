/* Gesture worklets intentionally mutate UI-thread shared values. */
/* eslint-disable react-hooks/immutability */
import { useEffect, useLayoutEffect, useMemo } from 'react';
import { AppState, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, runOnJS, useAnimatedStyle, useSharedValue, withSpring, ReduceMotion, type SharedValue } from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { TIME_STEPS } from './timeSteps';
import { previewUnit, releasedUnit, resistedOffset, STEP_WIDTH } from './carousel';
import { stepperHaptic } from './stepperHaptics';

function Item({ index, selected, offset, dragging }: { index: number; selected: SharedValue<number>; offset: SharedValue<number>; dragging: SharedValue<boolean> }) {
  const t = useTheme();
  const style = useAnimatedStyle(() => {
    const x = (index - selected.value) * STEP_WIDTH + offset.value;
    return { transform: [{ translateX: x }], opacity: Math.max(0, 1 - Math.abs(x) / (dragging.value ? 200 : 120)) };
  });
  return <Animated.Text accessible={false} style={[t.type.fraktionSm, { position: 'absolute', width: 100, textAlign: 'center', color: t.color.txPrimary }, style]}>{TIME_STEPS[index].label}</Animated.Text>;
}
export function IntervalCarousel({ unit, onChange, onReset, enabled, offsetLabel, resetLabel, differential }: {
  unit: number; onChange: (unit: number) => void; onReset: () => void; enabled: boolean;
  offsetLabel: string; resetLabel: string; differential: boolean;
}) {
  const t = useTheme();
  const selected = useSharedValue(unit), offset = useSharedValue(0), dragging = useSharedValue(false);
  const initial = useSharedValue({ x: 0, y: 0 });
  const hovered = useSharedValue<number | null>(null), allowed = useSharedValue(enabled);
  useLayoutEffect(() => { selected.value = unit; }, [unit, selected]);
  useLayoutEffect(() => {
    allowed.value = enabled;
    if (!enabled) { cancelAnimation(offset); offset.value = 0; dragging.value = false; hovered.value = null; }
  }, [enabled, allowed, offset, dragging, hovered]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      allowed.value = enabled && state === 'active';
      if (state !== 'active') { cancelAnimation(offset); offset.value = 0; dragging.value = false; hovered.value = null; }
    });
    return () => { allowed.value = false; dragging.value = false; subscription.remove(); cancelAnimation(offset); };
  }, [enabled, allowed, offset, dragging, hovered]);
  const gesture = useMemo(() => {
    const pan = Gesture.Pan().enabled(enabled).maxPointers(1).manualActivation(true)
      .onTouchesDown(event => {
        const touch = event.allTouches[0];
        if (touch) initial.value = { x: touch.absoluteX, y: touch.absoluteY };
      })
      .onTouchesMove((event, manager) => {
        if (!allowed.value || event.numberOfTouches !== 1) { manager.fail(); return; }
        const touch = event.allTouches[0];
        if (!touch || dragging.value) return;
        const x = Math.abs(touch.absoluteX - initial.value.x), y = Math.abs(touch.absoluteY - initial.value.y);
        if (x > 5 || y > 5) { if (x > y) manager.activate(); else manager.fail(); }
      })
      .onStart(() => { cancelAnimation(offset); dragging.value = true; hovered.value = null; })
      .onUpdate(event => {
        if (!allowed.value || !dragging.value) return;
        offset.value = resistedOffset(selected.value, event.translationX, TIME_STEPS.length);
        const preview = previewUnit(selected.value, event.translationX, TIME_STEPS.length);
        if (preview !== hovered.value) { hovered.value = preview; runOnJS(stepperHaptic)(); }
      })
      .onEnd((event, success) => {
        if (!success || !allowed.value || !dragging.value) return;
        const next = releasedUnit(selected.value, event.translationX, event.translationY, event.velocityX, TIME_STEPS.length);
        // Compensate when the selected index changes so labels spring from
        // their current on-screen positions, with no intermediate jump.
        offset.value += (next - selected.value) * STEP_WIDTH;
        if (next !== selected.value) { selected.value = next; runOnJS(onChange)(next); runOnJS(stepperHaptic)(); }
      })
      .onFinalize(() => {
        dragging.value = false; hovered.value = null;
        offset.value = withSpring(0, { duration: 300, dampingRatio: .85, reduceMotion: ReduceMotion.System });
      });
    const reset = Gesture.Tap().enabled(enabled).numberOfTaps(2).maxDelay(350).maxDistance(10)
      .onEnd((_event, success) => { if (success && allowed.value) { runOnJS(onReset)(); runOnJS(stepperHaptic)(true); } });
    return Gesture.Race(pan, reset);
  }, [enabled, selected, offset, dragging, hovered, allowed, initial, onChange, onReset]);
  return <GestureDetector gesture={gesture}>
    <View testID="time-interval-carousel" collapsable={false} accessible accessibilityRole="adjustable"
      accessibilityLabel="Time step size" accessibilityState={{ disabled: !enabled }}
      accessibilityValue={{ text: `${TIME_STEPS[unit].label}, ${offsetLabel}` }}
      accessibilityHint="Swipe left or right to change the interval. Double-tap to reset time."
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }, { name: 'reset', label: resetLabel }]}
      onAccessibilityAction={({ nativeEvent: { actionName } }) => {
        if (!enabled) return;
        if (actionName === 'reset') { onReset(); stepperHaptic(true); }
        if (actionName === 'increment' || actionName === 'decrement') {
          const next = Math.max(0, Math.min(TIME_STEPS.length - 1, unit + (actionName === 'increment' ? 1 : -1)));
          if (next !== unit) { onChange(next); stepperHaptic(); }
        }
      }}
      style={{ flex: 1, minWidth: 0, height: 44, justifyContent: 'center', gap: t.space.xs, opacity: enabled ? 1 : .4 }}>
      <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ height: 20, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {TIME_STEPS.map((_, index) => <Item key={index} index={index} selected={selected} offset={offset} dragging={dragging} />)}
      </View>
      <Text accessible={false} numberOfLines={1} style={[t.type.fraktionXs, { textAlign: 'center', color: differential ? t.color.icAccent : t.color.txTertiary }]}>{offsetLabel}</Text>
    </View>
  </GestureDetector>;
}
