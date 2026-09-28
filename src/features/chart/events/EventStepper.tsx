import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AppState, Pressable, ScrollView, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useTheme } from '@/theme';
import { ChartSheet, SheetHeader } from '../components/ChartSheet';
import { TimeStepButton } from '../time/TimeStepButton';
import { stepperHaptic } from '../time/stepperHaptics';
import { findEvent } from './api';
import type { EventCapabilities, EventMode, SkyEvent } from './types';

const SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
export function eventLabel(event: SkyEvent): string {
  if (event.kind === 'ingress') return `${event.body} → ${SIGNS[event.to_sign]}`;
  if (event.kind === 'station') return `${event.body} stations ${event.direction}`;
  return `${event.body} ${event.aspect.toLowerCase()} ${event.target.type === 'moving' ? event.target.body : 'fixed point'}`;
}
function localDate(time: number, timezone: string) {
  return new Intl.DateTimeFormat(undefined, { timeZone: timezone, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(time);
}
export interface EventStepperProps {
  mode: EventMode; capabilities: EventCapabilities; time: number; timezone: string; origin: number;
  kind: 'saved' | 'now'; enabled: boolean; onSeek: (time: number) => boolean; onReset: () => void; onUnavailable: () => void;
}
/** Bounded server navigation. The parent owns the guarded chart mutation. */
export function EventStepper(props: EventStepperProps) {
  const { mode, capabilities, time, timezone, enabled, onSeek, onReset, onUnavailable } = props;
  const t = useTheme();
  const [filter, setFilter] = useState('All');
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false);
  const [event, setEvent] = useState<SkyEvent | null>(null);
  const [message, setMessage] = useState('');
  const [ends, setEnds] = useState<Partial<Record<-1 | 1, boolean>>>({});
  const cursor = useRef<Partial<Record<-1 | 1, number>>>({});
  const request = useRef<AbortController | null>(null);
  const foreground = useRef(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const latest = useRef({ enabled: false, time, onSeek, onReset, onUnavailable });
  const query = useMemo(() => ({ ...mode.query,
    kinds: mode.kind === 'motion' && filter !== 'All' ? [filter === 'Ingress' ? 'ingress' as const : 'station' as const] : mode.query.kinds,
    aspects: mode.kind === 'aspect' && filter !== 'All' ? mode.query.aspects.filter(a => a === filter) : mode.query.aspects,
  }), [mode, filter]);
  const identity = JSON.stringify([mode.key, query, capabilities, time, enabled]);
  const cancel = useCallback(() => { request.current?.abort(); request.current = null; }, []);
  useLayoutEffect(() => {
    latest.current = { enabled: enabled && !sheet, time, onSeek, onReset, onUnavailable };
  }, [enabled, sheet, time, onSeek, onReset, onUnavailable]);
  useLayoutEffect(() => {
    cancel(); cursor.current = {};
    // A changed search context invalidates continuation and in-flight results.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBusy(false); setEnds({}); setMessage('');
    return cancel;
  }, [identity, cancel]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      foreground.current = state === 'active';
      if (!foreground.current) { cancel(); setBusy(false); }
    });
    return () => { latest.current.enabled = false; cancel(); sub.remove(); };
  }, [cancel]);
  const navigate = useCallback(async (direction: -1 | 1) => {
    if (!latest.current.enabled || !foreground.current || request.current || ends[direction]) return;
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setMessage('Searching…');
    try {
      const result = await findEvent(query, cursor.current[direction] ?? latest.current.time, direction, capabilities, controller.signal, cursor.current[direction] === undefined && event !== null && Date.parse(event.time) === latest.current.time);
      if (controller.signal.aborted || request.current !== controller || !latest.current.enabled || !foreground.current) return;
      if (result.event) {
        if (latest.current.onSeek(Date.parse(result.event.time))) { setEvent(result.event); setMessage(''); stepperHaptic(); }
      } else {
        cursor.current[direction] = result.boundary;
        setEnds(previous => ({ ...previous, [direction]: result.exhausted }));
        setMessage(result.exhausted ? 'No events to the service limit' : `No events through ${localDate(result.boundary, timezone)}. Continue ${direction === 1 ? 'forward' : 'backward'}.`);
      }
    } catch {
      if (!controller.signal.aborted && request.current === controller) {
        setMessage('Event service unavailable'); latest.current.onUnavailable();
      }
    } finally {
      if (request.current === controller) { request.current = null; setBusy(false); }
    }
  }, [query, capabilities, timezone, ends, event]);
  const reset = useCallback(() => {
    if (!latest.current.enabled || !foreground.current) return;
    cancel(); cursor.current = {}; setEnds({}); setMessage(''); setBusy(false); latest.current.onReset(); stepperHaptic(true);
  }, [cancel]);
  const openFilters = useCallback(() => {
    if (latest.current.enabled && foreground.current) { cancel(); setBusy(false); setSheet(true); }
  }, [cancel]);
  const gestures = useMemo(() => Gesture.Race(
    Gesture.Pan().enabled(enabled && !sheet).activeOffsetX([-12, 12]).failOffsetY([-12, 12]).runOnJS(true)
      // RNGH registers this callback; it does not invoke it during render.
      // eslint-disable-next-line react-hooks/refs
      .onEnd((e, success) => { if (success && Math.abs(e.translationX) > 24) void navigate(e.translationX < 0 ? 1 : -1); }),
    Gesture.Exclusive(
      // eslint-disable-next-line react-hooks/refs
      Gesture.Tap().enabled(enabled && !sheet).numberOfTaps(2).maxDelay(350).runOnJS(true).onEnd((_, success) => { if (success) reset(); }),
      // eslint-disable-next-line react-hooks/refs
      Gesture.Tap().enabled(enabled && !sheet).runOnJS(true).onEnd((_, success) => { if (success) openFilters(); }),
    ),
  ), [enabled, sheet, navigate, reset, openFilters]);
  const current = event && Date.parse(event.time) === time ? event : null;
  const title = current ? eventLabel(current) : mode.label;
  const detail = message || localDate(time, timezone);
  const visibleDetail = message.startsWith('No events through') ? 'No events · step again to search further' : detail;
  const options = mode.kind === 'motion' ? ['All', 'Ingress', 'Station'] : ['All', ...mode.query.aspects];
  return <>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingVertical: 6 }}>
      <TimeStepButton direction={-1} enabled={enabled && !sheet && !busy && !ends[-1]} interval="event" onStep={navigate} />
      <GestureDetector gesture={gestures}>
        <View testID="event-timeline" collapsable={false} accessible accessibilityRole="adjustable"
          accessibilityLabel={`${title}. ${detail}. Filter: ${filter}`} accessibilityState={{ disabled: !enabled, busy }}
          accessibilityHint="Swipe for the previous or next event. Tap for filters. Double-tap to reset time."
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }, { name: 'filters', label: 'Event filters' }, { name: 'reset', label: props.kind === 'saved' ? 'Return to original time' : 'Return to now' }]}
          onAccessibilityAction={({ nativeEvent: { actionName } }) => {
            if (actionName === 'increment') void navigate(1);
            if (actionName === 'decrement') void navigate(-1);
            if (actionName === 'reset') reset();
            if (actionName === 'filters') openFilters();
          }} style={{ flex: 1, minWidth: 0, height: 44, justifyContent: 'center', gap: t.space.xs, opacity: enabled ? 1 : .4 }}>
          <Text accessible={false} numberOfLines={1} style={[t.type.fraktionSm, { textAlign: 'center', color: t.color.txPrimary }]}>{title} · {filter} ⌄</Text>
          <Text accessible={false} numberOfLines={1} style={[t.type.fraktionXs, { textAlign: 'center', color: t.color.txTertiary }]}>{visibleDetail}</Text>
        </View>
      </GestureDetector>
      <TimeStepButton direction={1} enabled={enabled && !sheet && !busy && !ends[1]} interval="event" onStep={navigate} />
    </View>
    <ChartSheet visible={sheet} onClose={() => setSheet(false)}>
      <SheetHeader title="Event filters" closeLabel="Close event filters" onClose={() => setSheet(false)} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
        <Text style={[t.type.whyteSm, { color: t.color.txSecondary }]}>{mode.label}</Text>
        <Text style={[t.type.fraktionXs, { color: t.color.txSecondary }]}>{detail}</Text>
        {options.map(option => <Pressable key={option} accessibilityRole="radio" accessibilityState={{ checked: filter === option }}
          accessibilityLabel={option} onPress={() => { cancel(); setEvent(null); setFilter(option); setSheet(false); }}
          style={{ minHeight: 44, padding: 12, borderRadius: 12, backgroundColor: t.color.bgSolidCardSecondary }}>
          <Text style={[t.type.whyteSm, { color: t.color.txPrimary }]}>{filter === option ? '✓ ' : ''}{option}</Text>
        </Pressable>)}
      </ScrollView>
    </ChartSheet>
  </>;
}
