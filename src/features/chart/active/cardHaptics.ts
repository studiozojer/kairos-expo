import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

export type CardFeedback = 'lift' | 'slot' | 'armed' | 'removed';

/** System haptic settings apply; unsupported hardware must not affect a drop. */
export function cardHaptic(event: CardFeedback) {
  const feedback = Platform.OS === 'android'
    ? Haptics.performAndroidHapticsAsync({ lift: Haptics.AndroidHaptics.Drag_Start, slot: Haptics.AndroidHaptics.Segment_Tick,
      armed: Haptics.AndroidHaptics.Gesture_Start, removed: Haptics.AndroidHaptics.Confirm }[event])
    : event === 'removed' ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
      : Haptics.impactAsync({ lift: Haptics.ImpactFeedbackStyle.Medium, slot: Haptics.ImpactFeedbackStyle.Light, armed: Haptics.ImpactFeedbackStyle.Rigid }[event]);
  void feedback.catch(() => {});
}
