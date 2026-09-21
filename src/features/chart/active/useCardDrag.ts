/* SharedValue writes happen in effects/native callbacks, never React render. */
/* eslint-disable react-hooks/immutability */
import { Gesture } from 'react-native-gesture-handler';
import { cancelAnimation, ReduceMotion, runOnJS, useAnimatedReaction, useSharedValue, withSpring } from 'react-native-reanimated';
import { cardSlotAt, slotCardWidth } from './cardSlots';
import { isPutAwayPoint, resolveCardDrop } from './cardDrop';
import type { CardDragSession } from './useCardDragSession';

/** Native recognizer and UI-thread movement. Only feedback edges and the final
 * action cross to JS. The platform menu remains the non-drag alternative. */
export function useCardDrag({ id, index, ids, width, height, gap, session }: {
  id: string; index: number; ids: string[]; width: number; height: number; gap: number; session: CardDragSession;
}) {
  const { dragging, target, armed, epoch, sequence, available, reducedMotion, viewport, commit, feedback } = session;
  const x = useSharedValue(0), y = useSharedValue(0), left = useSharedValue(0), top = useSharedValue(0);
  const valid = useSharedValue(false), dismissed = useSharedValue(false);
  const version = useSharedValue(-1), serial = useSharedValue(0);
  useAnimatedReaction(() => epoch.value, () => {
    valid.value = false; dismissed.value = false;
    cancelAnimation(x); cancelAnimation(y); x.value = 0; y.value = 0;
  });
  const gesture = Gesture.Pan().withTestId(`card-drag-${id}`).minDistance(5).maxPointers(1)
    .onBegin(event => {
      cancelAnimation(x); cancelAnimation(y); x.value = 0; y.value = 0; dismissed.value = false;
      const stride = slotCardWidth(width, ids.length, gap) + gap;
      left.value = event.absoluteX - event.x - index * stride;
      top.value = event.absoluteY - event.y;
      version.value = epoch.value;
      valid.value = width > 0 && viewport.height > 0 && available.value;
    })
    .onStart(() => {
      if (!valid.value || version.value !== epoch.value || (dragging.value && dragging.value !== id)) { valid.value = false; return; }
      serial.value = ++sequence.value;
      dragging.value = id; target.value = index; armed.value = false;
      runOnJS(feedback)('lift', version.value, serial.value);
    })
    .onUpdate(event => {
      if (!valid.value || version.value !== epoch.value || dragging.value !== id) return;
      x.value = event.translationX; y.value = event.translationY;
      const nextArmed = isPutAwayPoint(event.absoluteX, event.absoluteY, viewport);
      const slot = nextArmed ? -1 : cardSlotAt(event.absoluteX - left.value, event.absoluteY - top.value, width, height, ids.length);
      if (nextArmed && !armed.value) runOnJS(feedback)('armed', version.value, serial.value);
      else if (!nextArmed && slot >= 0 && slot !== index && slot !== target.value) runOnJS(feedback)('slot', version.value, serial.value);
      armed.value = nextArmed; target.value = slot;
    })
    .onEnd((event, success) => {
      if (!valid.value || version.value !== epoch.value || dragging.value !== id || !success) return;
      valid.value = false;
      const drop = resolveCardDrop(id, ids, event.absoluteX, event.absoluteY, viewport, { x: left.value, y: top.value, width, height });
      // Remove at the release position; never flash the card back in its slot.
      dismissed.value = drop.kind === 'remove';
      if (drop.kind === 'reorder') { x.value = 0; y.value = 0; }
      runOnJS(commit)(drop, version.value, serial.value);
    })
    .onFinalize(() => {
      valid.value = false;
      if (dragging.value === id) { dragging.value = ''; target.value = -1; armed.value = false; }
      if (!dismissed.value) {
        x.value = withSpring(0, { damping: 22, stiffness: 240, reduceMotion: reducedMotion.value ? ReduceMotion.Always : ReduceMotion.Never });
        y.value = withSpring(0, { damping: 22, stiffness: 240, reduceMotion: reducedMotion.value ? ReduceMotion.Always : ReduceMotion.Never });
      }
    });
  return { gesture, x, y, dismissed };
}
