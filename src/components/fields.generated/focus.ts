import { Platform } from 'react-native';

/** Pointer clicks do not leave a persistent focus treatment on web. */
export function fieldFocusVisible(event: { currentTarget: unknown }) {
  if (Platform.OS !== 'web') return true;
  const target = event.currentTarget as { matches?: (selector: string) => boolean } | null;
  return !!target?.matches?.(':focus-visible');
}
