/* SharedValue writes happen in effects/native callbacks, never React render. */
/* eslint-disable react-hooks/immutability */
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { AccessibilityInfo, AppState } from 'react-native';
import { useReducedMotion, useSharedValue } from 'react-native-reanimated';
import type { CardDrop, WindowRect } from './cardDrop';
import { cardHaptic, type CardFeedback } from './cardHaptics';

/** Transient screen-owned drag state. Epochs reject JS work queued before a
 * layout/membership/focus change; sequence numbers make releases single-use. */
export function useCardDragSession({ ids, viewport, enabled, onDrop }: {
  ids: string[]; viewport: WindowRect; enabled: boolean; onDrop: (drop: Exclude<CardDrop, { kind: 'cancel' }>) => void;
}) {
  const dragging = useSharedValue(''), target = useSharedValue(-1), armed = useSharedValue(false);
  const epoch = useSharedValue(0), sequence = useSharedValue(0), available = useSharedValue(false);
  const reducedMotion = useSharedValue(useReducedMotion());
  useEffect(() => {
    let listening = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (listening) reducedMotion.value = value; });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', value => { reducedMotion.value = value; });
    return () => { listening = false; subscription.remove(); };
  }, [reducedMotion]);
  const revision = useRef(0), committed = useRef(0);
  const latest = useRef({ ids, enabled, onDrop });
  useLayoutEffect(() => { latest.current = { ids, enabled, onDrop }; });
  const invalidate = useCallback(() => {
    revision.current += 1;
    epoch.value = revision.current;
    dragging.value = ''; target.value = -1; armed.value = false;
  }, [epoch, dragging, target, armed]);
  const order = ids.join('|');
  useLayoutEffect(() => {
    invalidate();
    available.value = enabled && AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
    const subscription = AppState.addEventListener('change', state => {
      available.value = enabled && state === 'active';
      if (state !== 'active') invalidate();
    });
    return () => { subscription.remove(); available.value = false; invalidate(); };
  }, [order, viewport.x, viewport.y, viewport.width, viewport.height, enabled, invalidate, available]);
  const commit = useCallback((drop: CardDrop, version: number, serial: number) => {
    if (version !== revision.current || serial <= committed.current || serial !== sequence.value || !available.value || !latest.current.enabled) return;
    committed.current = serial;
    if (drop.kind === 'cancel' || !latest.current.ids.includes(drop.id)) return;
    if (drop.kind === 'reorder' && !latest.current.ids.includes(drop.targetId)) return;
    latest.current.onDrop(drop);
    if (drop.kind === 'remove') cardHaptic('removed');
  }, [available, sequence]);
  const feedback = useCallback((event: CardFeedback, version: number, serial: number) => {
    if (version === revision.current && serial === sequence.value && dragging.value && available.value) cardHaptic(event);
  }, [available, sequence, dragging]);
  return { dragging, target, armed, epoch, sequence, available, reducedMotion, viewport, invalidate, commit, feedback };
}
export type CardDragSession = ReturnType<typeof useCardDragSession>;
