import { Text, View } from 'react-native';

import { useTheme } from '@/theme';

/**
 * Home. The journal tab — the product's center of gravity (pivot seed D1).
 *
 * Stage 4 builds the daily glance here: the at-a-glance check-in with
 * breadcrumbs into the journal's depth. Until then this screen's job is to
 * prove the shell: glass bar at the bottom, daoUI tokens on the surface.
 *
 * The tab's name is deliberately undecided — "Journal" in the bar is a
 * placeholder, not a decision.
 */
export default function JournalHome() {
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
        The daily glance lands here.
      </Text>
      <Text style={{ ...theme.type.body, color: theme.color.txSecondary, textAlign: 'center' }}>
        Stage 4 — the journal home.{'\n'}The sky is the index; the life is the record.
      </Text>
    </View>
  );
}
