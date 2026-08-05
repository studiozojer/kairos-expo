import { Text, View } from 'react-native';

import { useTheme } from '@/theme';

/**
 * Search — the separated accessory tab (`role="search"` in the bar).
 *
 * Stage 5 wires the corpus: patterns, charts, dates, and journal entries,
 * ranked by the Rust fuzzy engine that already powers kairos-ios's search
 * (pivot seed D6 — the engine is cross-platform; the port is corpus wiring
 * plus the four focus states, not a rebuild). The expanding search field is
 * the platform's `headerSearchBarOptions`, adopted by structure when this
 * group grows its own Stack.
 */
export default function SearchHome() {
  const theme = useTheme();

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.color.bgSolidBase,
        alignItems: 'center',
        justifyContent: 'center',
        padding: theme.space.xl,
        gap: theme.space.sm,
      }}>
      <Text style={{ ...theme.type.title, color: theme.color.txPrimary, textAlign: 'center' }}>
        Search everything.
      </Text>
      <Text style={{ ...theme.type.body, color: theme.color.txSecondary, textAlign: 'center' }}>
        Stage 5 — patterns, charts, dates, entries.{'\n'}One bar; the grammar decides.
      </Text>
    </View>
  );
}
