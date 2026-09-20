/* Gesture callbacks execute on the UI thread, not during React render.
 * Reanimated shared values are intentionally mutable in those callbacks. */
/* eslint-disable react-hooks/immutability, react-hooks/purity */
import type { Transforms3d } from '@shopify/react-native-skia';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Gesture } from 'react-native-gesture-handler';
import { cancelAnimation, runOnJS, runOnUI, useDerivedValue, useFrameCallback, useSharedValue, withSpring } from 'react-native-reanimated';
import { beginDrag, clamp, constrain, IDENTITY, momentumStep, moveDrag, releaseVelocity, zoomAt, type Drag, type Point, type WheelTransform } from './motion';
import { hitTarget, type ChartTarget } from './selection';

export function useChartGesture(size: number, targets: ChartTarget[], enabled: boolean,
  onTap: (id: string | null) => void, onLongPress: (id: string) => void, baseCenter: Point = { x: size / 2, y: size / 2 }) {
  const originX = baseCenter.x - size / 2, originY = baseCenter.y - size / 2;
  const localPoint = useCallback((point: Point) => {
    'worklet'; return { x: point.x - originX, y: point.y - originY };
  }, [originX, originY]);
  const scale = useSharedValue(1), x = useSharedValue(0), y = useSharedValue(0);
  const drag = useSharedValue<Drag | null>(null), active = useSharedValue(false);
  const velocity = useSharedValue<Point>({ x: 0, y: 0 }), momentum = useSharedValue(false);
  const lastTap = useSharedValue<{ time: number; point: Point; hit: string | null } | null>(null);
  const allowed = useSharedValue(enabled), reduced = useSharedValue(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (mounted) setReduceMotion(value); });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { mounted = false; subscription.remove(); };
  }, []);

  const read = useCallback(() => { 'worklet'; return { scale: scale.value, x: x.value, y: y.value }; }, [scale, x, y]);
  const assign = useCallback((value: WheelTransform) => { 'worklet'; scale.value = value.scale; x.value = value.x; y.value = value.y; }, [scale, x, y]);
  const stop = useCallback(() => {
    'worklet'; momentum.value = false; velocity.value = { x: 0, y: 0 };
    cancelAnimation(scale); cancelAnimation(x); cancelAnimation(y);
  }, [momentum, velocity, scale, x, y]);
  const settle = useCallback((value: WheelTransform) => {
    'worklet'; stop(); const next = constrain(value, size);
    if (reduced.value) { assign(next); return; }
    const spring = { stiffness: 200, damping: 30, mass: 1, overshootClamping: true };
    scale.value = withSpring(next.scale, spring); x.value = withSpring(next.x, spring); y.value = withSpring(next.y, spring);
  }, [stop, size, reduced, assign, scale, x, y]);
  const suspend = useCallback(() => {
    runOnUI(() => { 'worklet'; stop(); drag.value = null; active.value = false; lastTap.value = null; assign(constrain(read(), size)); })();
  }, [size, drag, active, lastTap, stop, assign, read]);
  useEffect(() => { allowed.value = enabled; if (!enabled) suspend(); }, [enabled, allowed, suspend]);
  useEffect(() => { reduced.value = reduceMotion; if (reduceMotion) suspend(); }, [reduceMotion, reduced, suspend]);
  useEffect(() => { suspend(); }, [size, originX, originY, suspend]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => { if (state !== 'active') suspend(); });
    return () => { subscription.remove(); suspend(); };
  }, [suspend]);
  useFocusEffect(useCallback(() => () => suspend(), [suspend]));

  useFrameCallback(frame => {
    if (!momentum.value) return;
    const next = momentumStep(read(), velocity.value, (frame.timeSincePreviousFrame ?? 16) / 1000, size);
    assign(next.transform); velocity.value = next.velocity; momentum.value = next.active;
  });
  const animatedTransform = useDerivedValue<Transforms3d>(() => [
    { translateX: originX + size / 2 + x.value }, { translateY: originY + size / 2 + y.value },
    { scale: scale.value }, { translateX: -size / 2 }, { translateY: -size / 2 },
  ]);

  // Manual touch tracking preserves pointer identity across 1→2→1 transitions.
  // It claims movement only after threshold, leaving taps/long presses native.
  const gesture = useMemo(() => {
    const motion = Gesture.Manual().enabled(enabled).shouldCancelWhenOutside(false)
      .onTouchesDown((event, manager) => {
        if (!allowed.value) { manager.fail(); return; }
        stop();
        if (!drag.value) { active.value = false; manager.begin(); }
        drag.value = beginDrag(event.allTouches.map(t => ({ ...t, ...localPoint(t) })), read(), Date.now());
        if (event.numberOfTouches >= 2) { active.value = true; lastTap.value = null; manager.activate(); }
      })
      .onTouchesMove((event, manager) => {
        if (!allowed.value || !drag.value || !event.allTouches.length) { manager.fail(); return; }
        if (!active.value) {
          const point = localPoint(event.allTouches[0]);
          if (Math.hypot(point.x - drag.value.anchor.x, point.y - drag.value.anchor.y) < 8) return;
          if (scale.value <= 1.001 && event.numberOfTouches === 1) return;
          active.value = true; lastTap.value = null; manager.activate();
        }
        const next = moveDrag(drag.value, event.allTouches.map(t => ({ ...t, ...localPoint(t) })), read(), Date.now(), size);
        drag.value = next.drag; assign(next.transform);
      })
      .onTouchesUp((event, manager) => {
        // Exclude changed IDs on both platforms: their allTouches conventions
        // need not agree on whether lifted pointers have already been removed.
        const touches = event.allTouches.filter(t => !event.changedTouches.some(up => up.id === t.id));
        if (touches.length) { drag.value = beginDrag(touches.map(t => ({ ...t, ...localPoint(t) })), read(), Date.now()); return; }
        if (active.value) {
          if (scale.value <= 1.01) settle(IDENTITY);
          else if (reduced.value) assign(constrain(read(), size));
          else { velocity.value = drag.value ? releaseVelocity(drag.value, Date.now()) : { x: 0, y: 0 }; momentum.value = true; }
          manager.end();
        } else manager.fail();
        active.value = false; drag.value = null;
      })
      .onTouchesCancelled((_event, manager) => { stop(); assign(constrain(read(), size)); drag.value = null; active.value = false; manager.fail(); })
      .onFinalize(() => { drag.value = null; active.value = false; });
    const tap = Gesture.Tap().enabled(enabled).maxDistance(8).onEnd((event, success) => {
      if (!success || !allowed.value) return;
      const point = localPoint(event), now = Date.now();
      const hit = hitTarget(targets, point, read(), size), previous = lastTap.value;
      runOnJS(onTap)(hit);
      if (previous && now - previous.time < 350 && Math.hypot(point.x - previous.point.x, point.y - previous.point.y) < 30 && !previous.hit && !hit) {
        settle(scale.value > 1.001 ? IDENTITY : zoomAt(read(), 2, point, size));
        lastTap.value = null;
      } else lastTap.value = { time: now, point, hit };
    });
    const hold = Gesture.LongPress().enabled(enabled).minDuration(500).maxDistance(8).onStart(event => {
      if (!allowed.value) return;
      lastTap.value = null;
      const id = hitTarget(targets, localPoint(event), read(), size);
      if (id) runOnJS(onLongPress)(id);
    });
    return Gesture.Race(motion, hold, tap);
  }, [localPoint, size, targets, enabled, onTap, onLongPress, active, allowed, assign, drag, lastTap, momentum, read, reduced, scale, settle, stop, velocity]);

  const reset = () => runOnUI(() => { 'worklet'; settle(IDENTITY); })();
  const zoom = (direction: number) => runOnUI(() => {
    'worklet'; settle(zoomAt(read(), clamp(scale.value + direction * .5, 1, 3), { x: size / 2, y: size / 2 }, size));
  })();
  return { gesture, animatedTransform, reset, zoom };
}
