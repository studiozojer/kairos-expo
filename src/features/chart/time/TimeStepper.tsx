import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { AppState, Platform, Pressable, ScrollView, Text, View } from 'react-native';
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
    <Text accessible={false} style={[theme.type.whyteSm, { color: theme.color.icPrimary }]}>{glyph}</Text>
  </Pressable>;
}

const DIAL_ROW_HEIGHT = 24;

/** A full-height system wheel does not fit the 44pt tab accessory. Native
 * ScrollView owns scrolling/deceleration/snapping; we supply compact rows. */
export function IntervalDial({ unit, onChange, onTap, onReset, onScrollStart }: {
  unit: number; onChange: (unit: number) => void; onTap: () => void; onReset: () => void; onScrollStart: () => void;
}) {
  const theme = useTheme();
  const scroll = useRef<ScrollView>(null);
  const scrolling = useRef(false);
  const dragging = useRef(false);
  const initialOffset = useRef({ x: 0, y: unit * DIAL_ROW_HEIGHT });
  const idle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    // UIKit mounts two accessory copies. The idle copy follows shared state;
    // the copy under the finger keeps its native scroll animation.
    if (!scrolling.current) scroll.current?.scrollTo({ y: unit * DIAL_ROW_HEIGHT, animated: false });
  }, [unit]);
  useEffect(() => () => clearTimeout(idle.current), []);
  const finish = () => { clearTimeout(idle.current); scrolling.current = false; };
  return <View style={{ width: 104, height: 44 }}>
    <View pointerEvents="none" style={{ position: 'absolute', top: 10, left: 4, right: 4, height: 24,
      borderRadius: 6, backgroundColor: theme.color.bgSecondary }} />
    <ScrollView ref={scroll} testID="time-interval-dial" showsVerticalScrollIndicator={false}
      contentOffset={initialOffset.current}
      contentContainerStyle={{ paddingVertical: 10 }}
      snapToInterval={DIAL_ROW_HEIGHT} decelerationRate="fast" bounces={false}
      scrollEventThrottle={16} accessible accessibilityRole="adjustable" accessibilityLabel="Time step size"
      accessibilityValue={{ text: TIME_STEPS[unit].label }}
      accessibilityHint="Swipe up or down to change the interval. Double-tap the stepper to return to now."
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }, { name: 'reset', label: 'Return to now' }]}
      onAccessibilityAction={({ nativeEvent }) => {
        if (nativeEvent.actionName === 'increment') onChange(Math.min(TIME_STEPS.length - 1, unit + 1));
        if (nativeEvent.actionName === 'decrement') onChange(Math.max(0, unit - 1));
        if (nativeEvent.actionName === 'reset') onReset();
      }}
      onScrollBeginDrag={() => { dragging.current = scrolling.current = true; clearTimeout(idle.current); onScrollStart(); }}
      onScroll={event => {
        if (!scrolling.current) return;
        const next = Math.max(0, Math.min(TIME_STEPS.length - 1, Math.round(event.nativeEvent.contentOffset.y / DIAL_ROW_HEIGHT)));
        onChange(next);
        clearTimeout(idle.current);
        if (!dragging.current) idle.current = setTimeout(finish, 200);
      }}
      onScrollEndDrag={() => { dragging.current = false; clearTimeout(idle.current); idle.current = setTimeout(finish, 200); }}
      onMomentumScrollBegin={() => { scrolling.current = true; clearTimeout(idle.current); }}
      onMomentumScrollEnd={finish}>
      {TIME_STEPS.map((entry, index) => <Pressable key={entry.label} accessible={false}
        onPress={() => { if (index === unit) onTap(); else onChange(index); }}
        style={{ height: DIAL_ROW_HEIGHT, justifyContent: 'center', alignItems: 'center' }}>
        <Text accessible={false} style={[theme.type.fraktionXs, {
          color: index === unit ? theme.color.txPrimary : theme.color.txTertiary,
        }]}>{entry.label}</Text>
      </Pressable>)}
    </ScrollView>
  </View>;
}

/** The shell/material is UIKit's on iOS 26. Only the controls live here. */
export function TimeStepper({ compact = false }: { compact?: boolean }) {
  const theme = useTheme();
  const clock = useChartTime();
  const lastTap = useRef<number | null>(null);
  const reset = () => { lastTap.current = null; clock.reset(); };
  const tap = () => {
    const now = Date.now();
    if (lastTap.current !== null && now - lastTap.current < 350) reset();
    else lastTap.current = now;
  };
  const offset = timeOffset(clock.time, clock.origin);
  const status = clock.status === 'loading' ? 'Updating' : clock.status === 'error' ? 'Retry' : '';
  return <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 8, paddingRight: 2,
    height: 44, width: '100%' }}>
    <IntervalDial unit={clock.unit} onChange={unit => { lastTap.current = null; clock.selectUnit(unit); }} onTap={tap} onReset={reset}
      onScrollStart={() => { lastTap.current = null; }} />
    <Pressable accessibilityRole="button" accessibilityLabel={`Chart time: ${offset}${status ? `, ${status}` : ''}`}
      accessibilityHint="Double-tap to return to now" onPress={tap}
      accessibilityActions={[{ name: 'reset', label: 'Return to now' },
        ...(clock.status === 'error' ? [{ name: 'retry', label: 'Retry chart calculation' }] : [])]}
      onAccessibilityAction={({ nativeEvent }) => {
        if (nativeEvent.actionName === 'reset') reset();
        if (nativeEvent.actionName === 'retry') clock.retry();
      }}
      style={{ flex: 1, minWidth: 0, height: 44, paddingHorizontal: 8, justifyContent: 'center' }}>
      <Text numberOfLines={1} style={[theme.type.fraktionXxs, { color: theme.color.txAccent }]}>{offset}</Text>
      {!compact && status !== '' && <Text numberOfLines={1} style={[theme.type.fraktionXxs, { color: theme.color.txSecondary }]}>{status}</Text>}
    </Pressable>
    {clock.status === 'error' && <Pressable accessibilityRole="button" accessibilityLabel="Retry chart calculation"
      onPress={clock.retry} style={{ minWidth: 44, height: 44, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={[theme.type.whyteSm, { color: theme.color.txAccent }]}>↻</Text>
    </Pressable>}
    <RepeatButton label={`Step backward ${TIME_STEPS[clock.unit].label.toLowerCase()}`} glyph="‹"
      disabled={!clock.canStepBackward} onStep={() => { lastTap.current = null; clock.step(-1); }} />
    <RepeatButton label={`Step forward ${TIME_STEPS[clock.unit].label.toLowerCase()}`} glyph="›"
      disabled={!clock.canStepForward} onStep={() => { lastTap.current = null; clock.step(1); }} />
  </View>;
}

export function NativeTimeAccessory() {
  const placement = NativeTabs.BottomAccessory.usePlacement();
  return <TimeStepper compact={placement === 'inline'} />;
}
