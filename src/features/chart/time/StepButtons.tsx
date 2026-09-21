import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AppState, Pressable, Text, View, type GestureResponderEvent } from 'react-native';
import { useTheme } from '@/theme';

type Direction = -1 | 1;
type Props = { interval: string; canBackward: boolean; canForward: boolean; onStep: (direction: Direction) => void };
const SIZE = 44;
const GAP = 8;

/** One native responder retains the touch across both buttons. Individual
 * accessible buttons remain available to VoiceOver and switch control. */
export function StepButtons(props: Props) {
  const theme = useTheme();
  const latest = useRef(props);
  const active = useRef<Direction | null>(null);
  const held = useRef(false);
  const started = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [highlight, setHighlight] = useState<Direction | null>(null);
  const allowed = (direction: Direction) => direction === -1 ? latest.current.canBackward : latest.current.canForward;
  const stop = useCallback(() => {
    clearTimeout(timer.current);
    active.current = null;
    setHighlight(null);
  }, []);
  const end = useCallback(() => { held.current = false; stop(); }, [stop]);
  useLayoutEffect(() => {
    latest.current = props;
    if (active.current !== null && !allowed(active.current)) stop();
  }, [props, stop]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => { if (state !== 'active') end(); });
    return () => { clearTimeout(timer.current); held.current = false; subscription.remove(); };
  }, [end]);

  const directionAt = ({ nativeEvent: { locationX: x, locationY: y } }: GestureResponderEvent): Direction | null => {
    if (y < 0 || y > SIZE) return null;
    if (x >= 0 && x < SIZE) return -1;
    if (x >= SIZE + GAP && x <= SIZE * 2 + GAP) return 1;
    return null;
  };
  const move = (event: GestureResponderEvent) => {
    if (!held.current) return;
    if (event.nativeEvent.touches.length !== 1) { end(); return; }
    const candidate = directionAt(event);
    const next = candidate !== null && allowed(candidate) ? candidate : null;
    if (next === active.current) return;
    stop();
    if (next === null) return;
    active.current = next;
    setHighlight(next);
    latest.current.onStep(next);
    const repeat = () => {
      if (!held.current || active.current !== next || !allowed(next)) { stop(); return; }
      latest.current.onStep(next);
      timer.current = setTimeout(repeat, 80);
    };
    // Sliding after a hold keeps the repeat cadence, without another long delay.
    timer.current = setTimeout(repeat, Math.max(80, 500 - (Date.now() - started.current)));
  };
  return <View style={{ flexDirection: 'row', gap: GAP, width: SIZE * 2 + GAP, height: SIZE }}>
    {([-1, 1] as const).map(direction => {
      const disabled = direction === -1 ? !props.canBackward : !props.canForward;
      return <Pressable key={direction} accessibilityRole="button"
        accessibilityLabel={`Step ${direction === -1 ? 'backward' : 'forward'} ${props.interval}`}
        accessibilityHint="Hold to keep stepping; slide to the other arrow to change direction"
        accessibilityState={{ disabled }} disabled={disabled}
        onPress={() => { if (!disabled) props.onStep(direction); }}
        style={({ pressed }) => ({ width: SIZE, height: SIZE, borderRadius: SIZE / 2,
          alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.3 : 1,
          backgroundColor: highlight === direction || pressed ? theme.color.bgSecondary : 'transparent' })}>
        <Text accessible={false} style={[theme.type.whyteMd, { color: theme.color.icPrimary }]}>{direction === -1 ? '‹' : '›'}</Text>
      </Pressable>;
    })}
    {/* No children: locationX/Y always belong to this shared touch surface. */}
    <View testID="step-buttons-touch" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={{ position: 'absolute', left: 0, top: 0, width: SIZE * 2 + GAP, height: SIZE }}
      onStartShouldSetResponder={() => true}
      onResponderGrant={event => { held.current = true; started.current = Date.now(); move(event); }}
      onResponderStart={event => { if (event.nativeEvent.touches.length !== 1) end(); }}
      onResponderMove={move} onResponderRelease={end} onResponderTerminate={end}
      onResponderTerminationRequest={() => true} />
  </View>;
}
