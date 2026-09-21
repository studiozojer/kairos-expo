/* SharedValue writes happen in effects/native callbacks, never React render. */
/* eslint-disable react-hooks/immutability */
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import { cancelAnimation, runOnJS, useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated';
import { cardSlotAt, slotCardWidth } from './cardSlots';

/** Native recognizers and UI-thread movement; only the completed drop crosses
 * to React. This row is an in-app ordering gesture, not a cross-app data drag. */
export function useCardDrag({ id, index, ids, width, height, gap, dragging, target, onDrop }: {
  id: string; index: number; ids: string[]; width: number; height: number; gap: number;
  dragging: SharedValue<string>; target: SharedValue<number>;
  onDrop: (id: string, targetId: string) => void;
}) {
  const x = useSharedValue(0), y = useSharedValue(0);
  const left = useSharedValue(0), top = useSharedValue(0);
  const valid = useSharedValue(false);
  const order = ids.join('|');
  useEffect(() => {
    const cancel = () => {
      valid.value = false;
      cancelAnimation(x); cancelAnimation(y);
      x.value = 0; y.value = 0;
      if (dragging.value === id) { dragging.value = ''; target.value = -1; }
    };
    // Geometry/order changes invalidate the gesture rather than using stale slots.
    cancel();
    const subscription = AppState.addEventListener('change', state => { if (state !== 'active') cancel(); });
    return () => { subscription.remove(); cancel(); };
  }, [order, width, height, gap, id, valid, x, y, dragging, target]);

  const gesture = Gesture.Pan().withTestId(`card-drag-${id}`).minDistance(5).maxPointers(1)
    .onBegin(event => {
      cancelAnimation(x); cancelAnimation(y);
      x.value = 0; y.value = 0;
      // Capture before the lifted view moves: local event coordinates afterward
      // are relative to its transformed position, not the stationary slots.
      const stride = slotCardWidth(width, ids.length, gap) + gap;
      left.value = event.absoluteX - event.x - index * stride;
      top.value = event.absoluteY - event.y;
      valid.value = width > 0;
    })
    .onStart(() => {
      if (!valid.value || (dragging.value && dragging.value !== id)) { valid.value = false; return; }
      dragging.value = id; target.value = index;
    })
    .onUpdate(event => {
      if (!valid.value || dragging.value !== id) return;
      x.value = event.translationX; y.value = event.translationY;
      target.value = cardSlotAt(event.absoluteX - left.value, event.absoluteY - top.value, width, height, ids.length);
    })
    .onEnd((event, success) => {
      if (!valid.value || dragging.value !== id || !success) return;
      const slot = cardSlotAt(event.absoluteX - left.value, event.absoluteY - top.value, width, height, ids.length);
      if (slot >= 0 && slot !== index) {
        x.value = 0; y.value = 0;
        runOnJS(onDrop)(id, ids[slot]);
      }
    })
    .onFinalize(() => {
      valid.value = false;
      if (dragging.value === id) { dragging.value = ''; target.value = -1; }
      x.value = withSpring(0, { damping: 22, stiffness: 240 });
      y.value = withSpring(0, { damping: 22, stiffness: 240 });
    });
  return { gesture, x, y };
}
