import { Stack } from 'expo-router/stack';

/**
 * The search group is its own Stack so the platform's search controller has a
 * header to live in — the field is navigation chrome, not app UI. Options are
 * set by the screen itself (`<Stack.Screen>` in index.tsx), where the search
 * bar's ref and callbacks are in scope.
 */
export default function SearchLayout() {
  return <Stack />;
}
