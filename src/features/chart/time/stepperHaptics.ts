import * as Haptics from 'expo-haptics';
export function stepperHaptic(reset = false) {
  void Haptics.impactAsync(reset ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}
