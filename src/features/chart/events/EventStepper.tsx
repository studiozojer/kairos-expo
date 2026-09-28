import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AppState, Pressable, ScrollView, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useTheme } from '@/theme';
import { ChartSheet, SheetHeader } from '../components/ChartSheet';
import { TimeStepButton } from '../time/TimeStepButton';
import { stepperHaptic } from '../time/stepperHaptics';
import { EventTimelineCache, eventNode, timelineSlots } from './timeline';
import { EventTimeline } from './EventTimeline';
import type { TimelineNode, TimelineTransition } from './timelineTypes';
import type { ChartColors } from '../schema/core-types';
import type { AspectHues } from '../schema/ring-styles';
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
  colors: ChartColors; aspectHues: AspectHues;
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
  const [entry, setEntry] = useState<number | null>(time);
  const [transition, setTransition] = useState<TimelineTransition>({ sequence: 0, direction: 0 });
  const [previewLoading, setPreviewLoading] = useState(false);
  const [cacheVersion, refreshCache] = useState(0);
  const [previewAttempt, refreshPreviews] = useState(0);
  const preview = useRef<AbortController | null>(null);
  const expectedSeek = useRef<number | null>(null);
  const previousTime = useRef(time);
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
  const cacheKey = JSON.stringify([query, capabilities]);
  const cache = useMemo(() => {
    const [cachedQuery, cachedCapabilities] = JSON.parse(cacheKey);
    return new EventTimelineCache(cachedQuery, cachedCapabilities);
  }, [cacheKey]);
  const identity = JSON.stringify([mode.key, query, capabilities, time, enabled]);
  const cancel = useCallback(() => { request.current?.abort(); request.current = null; preview.current?.abort(); preview.current = null; }, []);
  useLayoutEffect(() => {
    latest.current = { enabled: enabled && !sheet, time, onSeek, onReset, onUnavailable };
  }, [enabled, sheet, time, onSeek, onReset, onUnavailable]);
  useLayoutEffect(() => {
    cancel(); cursor.current = {};
    if (previousTime.current !== time) {
      if (expectedSeek.current !== time) {
        setTransition(value => ({ sequence: value.sequence + 1, direction: 0 }));
        setEntry(time);
      }
      previousTime.current = time;
    } else setTransition(value => ({ sequence: value.sequence + 1, direction: 0 }));
    expectedSeek.current = null;
    // A changed search context invalidates continuation and in-flight results.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBusy(false); setEnds({}); setMessage('');
    return cancel;
  }, [identity, time, cancel]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => {
      foreground.current = state === 'active';
      if (!foreground.current) { cancel(); setBusy(false); }
    });
    return () => { latest.current.enabled = false; cancel(); sub.remove(); };
  }, [cancel]);
  // Preview two neighbors in each direction. Each search is capped at four
  // new windows; foreground navigation can explicitly extend a sparse range.
  useEffect(() => {
    if (!enabled || sheet || !foreground.current) return;
    const controller = new AbortController(); preview.current = controller;
    setPreviewLoading(true);
    void Promise.all(([-1, 1] as const).map(async direction => {
      let anchor = time;
      for (let count = 0; count < 2; count++) {
        const result = await cache.search(anchor, direction, controller.signal,
          count > 0 || (event !== null && Date.parse(event.time) === time), 4);
        if (controller.signal.aborted) return;
        refreshCache(value => value + 1);
        if (!result.event) return;
        anchor = Date.parse(result.event.time);
      }
    })).catch(() => {
      if (!controller.signal.aborted && preview.current === controller) latest.current.onUnavailable();
    }).finally(() => {
      if (preview.current === controller) { preview.current = null; setPreviewLoading(false); }
    });
    return () => { controller.abort(); if (preview.current === controller) preview.current = null; };
    // A landed event's identity changes together with time; callback changes
    // and a paint-only rerender must not restart requests.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cache, time, enabled, sheet, previewAttempt]);
  const cachedEvents = useMemo(() => {
    void cacheVersion;
    return cache.eventsAround(time);
  }, [cache, time, cacheVersion]);
  const markers = useMemo(() => ([
    { id: 'origin', kind: 'origin', time: props.origin },
    ...(entry === null ? [] : [{ id: 'entry', kind: 'entry' as const, time: entry }]),
  ] as TimelineNode[]).filter(node => node.time >= Date.parse(capabilities.supported_from) && node.time < Date.parse(capabilities.supported_to)), [props.origin, entry, capabilities.supported_from, capabilities.supported_to]);
  const slots = timelineSlots([...cachedEvents.map(eventNode), ...markers,
    ...(event && Date.parse(event.time) === time ? [eventNode(event)] : [])], time);
  const navigate = useCallback(async (direction: -1 | 1) => {
    if (!latest.current.enabled || !foreground.current || request.current || ends[direction]) return;
    preview.current?.abort(); preview.current = null; setPreviewLoading(false);
    const controller = new AbortController(); request.current = controller;
    setBusy(true); setMessage('Searching…');
    try {
      const result = await cache.search(cursor.current[direction] ?? latest.current.time, direction, controller.signal, cursor.current[direction] === undefined && (slots[2]?.kind === 'event' || (event !== null && Date.parse(event.time) === latest.current.time)));
      if (controller.signal.aborted || request.current !== controller || !latest.current.enabled || !foreground.current) return;
      const anchor = latest.current.time;
      const marker = markers.filter(node => direction * (node.time - anchor) > 0 &&
        direction * (result.boundary - node.time) >= 0)
        .sort((a, b) => direction * (a.time - b.time))[0];
      const destination = marker && (!result.event || direction * (marker.time - Date.parse(result.event.time)) < 0)
        ? marker : result.event ? eventNode(result.event) : null;
      refreshCache(value => value + 1);
      if (destination) {
        expectedSeek.current = destination.time;
        if (latest.current.onSeek(destination.time)) {
          setEvent(destination.kind === 'event' ? destination.event : null);
          setTransition(value => ({ sequence: value.sequence + 1, direction: destination.time === anchor ? 0 : direction }));
          setMessage(''); stepperHaptic();
        } else expectedSeek.current = null;
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
  }, [cache, timezone, ends, event, markers, slots]);
  const reset = useCallback(() => {
    if (!latest.current.enabled || !foreground.current) return;
    cancel(); cursor.current = {}; setEnds({}); setMessage(''); setBusy(false); setEvent(null); setEntry(null);
    expectedSeek.current = props.kind === 'saved' ? props.origin : null;
    setTransition(value => ({ sequence: value.sequence + 1, direction: 0 }));
    latest.current.onReset(); refreshPreviews(value => value + 1); stepperHaptic(true);
  }, [cancel, props.kind, props.origin]);
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
          }} style={{ flex: 1, minWidth: 0, height: 44, justifyContent: 'center', opacity: enabled ? 1 : .4 }}>
          <EventTimeline slots={slots} transition={transition} loading={busy || previewLoading} timezone={timezone}
            colors={props.colors} aspectHues={props.aspectHues} enabled={enabled && !sheet} />
          {!!message && <Text pointerEvents="none" accessible={false} numberOfLines={1}
            style={[t.type.fraktionXxs, { position: 'absolute', bottom: 0, left: 0, right: 0, textAlign: 'center', color: t.color.txSecondary, backgroundColor: t.color.bgSolidBase }]}>
            {message.startsWith('No events through') ? 'No events · step again to continue' : message}
          </Text>}
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
          accessibilityLabel={option} onPress={() => { cancel(); setFilter(option); setSheet(false); }}
          style={{ minHeight: 44, padding: 12, borderRadius: 12, backgroundColor: t.color.bgSolidCardSecondary }}>
          <Text style={[t.type.whyteSm, { color: t.color.txPrimary }]}>{filter === option ? '✓ ' : ''}{option}</Text>
        </Pressable>)}
      </ScrollView>
    </ChartSheet>
  </>;
}
