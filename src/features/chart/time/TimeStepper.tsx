import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, PanResponder, Platform, Pressable, Text, View } from 'react-native';
import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useTheme } from '@/theme';
import { useChartTime } from './ChartTimeContext';
import { TIME_STEPS, timeOffset } from './timeSteps';

export const hasNativeTimeAccessory = Platform.OS === 'ios' && Number.parseInt(String(Platform.Version), 10) >= 26;

export function RepeatButton({ label, glyph, disabled, onStep }: {
  label: string; glyph: string; disabled: boolean; onStep: () => void;
}) {
  const theme = useTheme();
  const action = useRef(onStep);
  useLayoutEffect(() => { action.current = onStep; }, [onStep]);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pressed = useRef(false);
  const fired = useRef(false);
  const stop = useCallback(() => {
    pressed.current = false;
    clearTimeout(timer.current);
  }, []);
  useEffect(() => { if (disabled) { stop(); fired.current = false; } }, [disabled, stop]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => { if (state !== 'active') stop(); });
    return () => { stop(); subscription.remove(); };
  }, [stop]);

  return <Pressable accessibilityRole="button" accessibilityLabel={label}
    accessibilityHint="Hold to keep stepping" accessibilityState={{ disabled }} disabled={disabled}
    onPressIn={() => {
      if (disabled) return;
      stop();
      pressed.current = fired.current = true;
      action.current();
      const repeat = () => {
        if (!pressed.current) return;
        action.current();
        timer.current = setTimeout(repeat, 80);
      };
      timer.current = setTimeout(repeat, 500);
    }}
    onPressOut={stop}
    onPress={() => {
      // Assistive activation may emit onPress without a physical press-in.
      if (!fired.current && !disabled) action.current();
      fired.current = false;
    }}
    style={({ pressed: down }) => ({ width: 44, height: 44, borderRadius: 22,
      alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.3 : down ? 0.55 : 1 })}>
    <Text accessible={false} style={[theme.type.whyteLg, { color: theme.color.icPrimary }]}>{glyph}</Text>
  </Pressable>;
}

/** The shell/material is UIKit's on iOS 26. Only the controls live here. */
export function TimeStepper({ compact = false }: { compact?: boolean }) {
  const theme = useTheme();
  const clock = useChartTime();
  const { unit, selectUnit, reset } = clock;
  const [drag] = useState(() => new Animated.Value(0));
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (active) setReduceMotion(value); });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { active = false; subscription.remove(); };
  }, []);
  const lastTap = useRef(0);
  const responder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 8 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
    onPanResponderMove: (_, gesture) => drag.setValue(Math.max(-80, Math.min(80, gesture.dx))),
    onPanResponderRelease: (_, gesture) => {
      if (Math.abs(gesture.dx) > 25 || Math.abs(gesture.vx) > 0.3) {
        const direction = (Math.abs(gesture.dx) > 25 ? gesture.dx : gesture.vx) < 0 ? 1 : -1;
        selectUnit(unit + direction);
      }
      if (reduceMotion) drag.setValue(0);
      else Animated.spring(drag, { toValue: 0, useNativeDriver: true }).start();
    },
    onPanResponderTerminate: () => drag.setValue(0),
  }), [drag, unit, selectUnit, reduceMotion]);

  const offset = timeOffset(clock.time, clock.origin);
  const progress = clock.status === 'loading' ? ' · Updating' : clock.status === 'error' ? ' · Retry' : '';
  return <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6,
    height: 44, width: '100%' }}>
    <RepeatButton label={`Step backward ${TIME_STEPS[unit].label.toLowerCase()}`} glyph="‹"
      disabled={!clock.canStepBackward} onStep={() => clock.step(-1)} />
    <View {...responder.panHandlers} style={{ flex: 1, minWidth: 0, alignItems: 'center' }}>
      <Pressable accessibilityRole="adjustable"
        accessibilityLabel="Time step size" accessibilityValue={{ text: `${TIME_STEPS[unit].label}, ${offset}${progress}` }}
        accessibilityHint="Adjust to change the interval. Use the Return to now action to reset."
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }, { name: 'reset', label: 'Return to now' },
          ...(clock.status === 'error' ? [{ name: 'retry', label: 'Retry chart calculation' }] : [])]}
        onAccessibilityAction={({ nativeEvent }) => {
          if (nativeEvent.actionName === 'increment') selectUnit(unit + 1);
          if (nativeEvent.actionName === 'decrement') selectUnit(unit - 1);
          if (nativeEvent.actionName === 'reset') reset();
          if (nativeEvent.actionName === 'retry') clock.retry();
        }}
        onPress={() => {
          if (clock.status === 'error') { clock.retry(); return; }
          const now = Date.now();
          if (lastTap.current && now - lastTap.current < 350) { reset(); lastTap.current = 0; }
          else lastTap.current = now;
        }}
        style={{ width: '100%', height: 44, overflow: 'hidden', justifyContent: 'center' }}>
        <Animated.View accessible={false} importantForAccessibility="no-hide-descendants"
          style={{ height: 24, transform: [{ translateX: drag }] }}>
          {[-1, 0, 1].map(offset => {
            const entry = TIME_STEPS[unit + offset];
            if (!entry || (compact && offset !== 0)) return null;
            return <Text key={offset} numberOfLines={1} style={[theme.type.fraktionXs, {
              color: offset === 0 ? theme.color.txPrimary : theme.color.txTertiary,
              opacity: offset === 0 ? 1 : 0.45, position: 'absolute', width: 90, left: '50%',
              marginLeft: -45 + offset * 90, textAlign: 'center',
            }]}>{entry.label}</Text>;
          })}
        </Animated.View>
        {!compact && <Text accessible={false} numberOfLines={1}
          style={[theme.type.fraktionXxs, { color: theme.color.txAccent, textAlign: 'center' }]}>
          {offset}{progress}
        </Text>}
      </Pressable>
    </View>
    <RepeatButton label={`Step forward ${TIME_STEPS[unit].label.toLowerCase()}`} glyph="›"
      disabled={!clock.canStepForward} onStep={() => clock.step(1)} />
  </View>;
}

export function NativeTimeAccessory() {
  const placement = NativeTabs.BottomAccessory.usePlacement();
  return <TimeStepper compact={placement === 'inline'} />;
}
