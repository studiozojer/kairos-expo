import { Stack } from 'expo-router/stack';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { useTheme } from '@/theme';

/**
 * Search — the separated accessory tab, opening wide into the platform's own
 * search field (headerSearchBarOptions → UISearchController on iOS).
 *
 * Two halves, both the platform's:
 *
 * 1. The separated accessory is structural — `role="search"` on the trigger
 *    (see app-tabs.tsx).
 * 2. The expanding field is `headerSearchBarOptions` on this screen. On
 *    iOS 26 it docks integrated with the tab area; tapping the accessory lands
 *    you here.
 *
 * The keyboard stays DOWN on arrival — David's call, 2026-08-05, against the
 * Apple-Music default of auto-activation. The platform currently agrees with
 * him for free: react-native-screens 4.26 maps role="search" to the legacy
 * UITabBarItem, not UISearchTab.automaticallyActivatesSearch, so nothing
 * focuses the field (upstream: software-mansion/react-native-screens#3999).
 * WATCH OUT: if screens adopts UISearchTab with auto-activation on, the
 * platform default flips under us and the keyboard will start opening on tab
 * switch — that upgrade needs the opt-out set explicitly.
 *
 * The corpus arrives in Stage 5 (pivot seed D6): patterns, charts, dates, and
 * journal entries, ranked by the Rust engine that already powers kairos-ios.
 * Until then the field is live and honest about being empty.
 */
export default function SearchHome() {
  const theme = useTheme();
  const [query, setQuery] = useState('');

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
      <Stack.Screen
        options={{
          title: 'Search',
          headerSearchBarOptions: {
            placeholder: 'Patterns, charts, dates, entries',
            hideWhenScrolling: false,
            autoCapitalize: 'none',
            tintColor: theme.color.txAccent,
            onChangeText: (e) => setQuery(e.nativeEvent.text),
            onCancelButtonPress: () => setQuery(''),
          },
        }}
      />
      {query.length === 0 ? (
        <>
          <Text style={{ ...theme.type.whyteLg, color: theme.color.txPrimary, textAlign: 'center' }}>
            Search everything.
          </Text>
          <Text style={{ ...theme.type.whyteSm, color: theme.color.txSecondary, textAlign: 'center' }}>
            Stage 5 — patterns, charts, dates, entries.{'\n'}One bar; the grammar decides.
          </Text>
        </>
      ) : (
        <Text style={{ ...theme.type.whyteSm, color: theme.color.txSecondary, textAlign: 'center' }}>
          “{query}” — results arrive in Stage 5.{'\n'}The engine that will rank them already does it
          in kairos-ios.
        </Text>
      )}
    </View>
  );
}
