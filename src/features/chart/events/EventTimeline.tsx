import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AppState, View } from 'react-native';
import { Canvas, Circle, Group, LinearGradient, Mask, Rect, Text, useFont, vec } from '@shopify/react-native-skia';
import { cancelAnimation, ReduceMotion, runOnUI, useDerivedValue, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { useTheme } from '@/theme';
import type { ChartColors } from '../schema/core-types';
import type { AspectHues } from '../schema/ring-styles';
import { EventSymbol, eventSymbolStyle } from './EventSymbol';
import type { TimelineSlots, TimelineTransition } from './timelineTypes';
import { timelineCompensation, timelineDate, timelineFadeStops, timelinePresentation, type TimelinePresentation, TIMELINE_HEIGHT, TIMELINE_PITCH } from './timelinePresentation';

export interface EventTimelineProps {
  slots: TimelineSlots; transition: TimelineTransition; loading: boolean; timezone: string;
  colors: ChartColors; aspectHues: AspectHues; enabled: boolean;
}
export function EventTimeline({ slots, transition, loading, timezone, colors, aspectHues, enabled }: EventTimelineProps) {
  const theme = useTheme();
  const font = useFont(require('@/assets/fonts/PPFraktionMono-Regular.otf'), theme.type.fraktionXs.fontSize);
  const [width, setWidth] = useState(0);
  const offset = useSharedValue(0);
  const sequence = useRef(transition.sequence);
  const reduceMotion = useReducedMotion();
  const [presentation, setPresentation] = useState<TimelinePresentation>({ sequence: transition.sequence, slots, travelling: false });
  const nextPresentation = timelinePresentation(presentation, slots, transition, enabled, reduceMotion);
  // React's render-time state adjustment keeps the new destination and its
  // compensation in the same commit; preview-only updates retain the snapshot.
  if (nextPresentation !== presentation) setPresentation(nextPresentation);
  const visibleSlots = nextPresentation.travelling ? nextPresentation.slots : slots;
  useEffect(() => {
    if (!nextPresentation.travelling) return;
    const sequence = nextPresentation.sequence;
    const timer = setTimeout(() => setPresentation(previous => previous.sequence === sequence ? { ...previous, travelling: false } : previous), 350);
    return () => clearTimeout(timer);
  }, [nextPresentation.sequence, nextPresentation.travelling]);
  const transform = useDerivedValue(() => [{ translateX: offset.value }]);
  const items = useMemo(() => visibleSlots.map(node => node ? {
    node, symbol: eventSymbolStyle(node, colors, aspectHues, theme), date: timelineDate(node.time, timezone),
  } : null), [visibleSlots, colors, aspectHues, theme, timezone]);
  useLayoutEffect(() => {
    const changed = sequence.current !== transition.sequence;
    sequence.current = transition.sequence;
    if (!enabled || transition.direction === 0 || reduceMotion) {
      runOnUI(() => { 'worklet'; cancelAnimation(offset); offset.value = 0; })();
    } else if (changed) {
      const direction = transition.direction;
      runOnUI(() => {
        'worklet';
        const residual = offset.value;
        cancelAnimation(offset);
        offset.value = timelineCompensation(residual, direction, false);
        offset.value = withSpring(0, { duration: 280, dampingRatio: .82, reduceMotion: ReduceMotion.System });
      })();
    }
  }, [transition.sequence, transition.direction, enabled, reduceMotion, offset]);
  useEffect(() => {
    const stop = () => { cancelAnimation(offset); offset.value = 0; };
    const sub = AppState.addEventListener('change', state => { if (state !== 'active') { stop(); setPresentation(previous => ({ ...previous, travelling: false })); } });
    return () => { sub.remove(); stop(); };
  }, [offset]);
  return <View testID="event-symbol-timeline" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none" onLayout={event => setWidth(event.nativeEvent.layout.width)} style={{ height: TIMELINE_HEIGHT, flex: 1, overflow: 'hidden' }}>
    {width > 0 && <Canvas style={{ width, height: TIMELINE_HEIGHT }}>
      {/* Clip to content alpha so the black mask never paints the gaps between symbols. */}
      <Mask mode="alpha" mask={<Rect x={0} y={0} width={width} height={TIMELINE_HEIGHT}><LinearGradient start={vec(0, 0)} end={vec(width, 0)} colors={['transparent', 'black', 'black', 'transparent']} positions={timelineFadeStops(width)} /></Rect>}>
        <Group transform={transform}>
          {items.map((item, index) => {
            const x = width / 2 + (index - 2) * TIMELINE_PITCH;
            if (!item) return loading ? <Group key={`loading-${index}`}>{[-5, 0, 5].map(dx => <Circle key={dx} cx={x + dx} cy={14} r={1.4} color={theme.color.txSecondary} />)}</Group> : null;
            return <Group key={item.node.id}>
              <EventSymbol style={item.symbol} x={x} y={14} />
              {font && <Text text={item.date} font={font} x={x - font.measureText(item.date).width / 2} y={TIMELINE_HEIGHT - font.getMetrics().descent} color={item.symbol.dateColor} />}
            </Group>;
          })}
        </Group>
      </Mask>
    </Canvas>}
  </View>;
}
