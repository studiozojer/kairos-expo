import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { useSegments } from 'expo-router';
import { hasNativeTimeAccessory, NativeTimeAccessory } from '@/features/chart/time/TimeStepper';

import { families } from '@/theme/fonts.gen';
import { useTheme } from '@/theme';

/**
 * Two tabs and a search — the Apple Music shape, obtained by structure.
 *
 * Journal is home (D1 of the pivot seed — the journal is the product, the sky
 * is its index). Chart carries the interactive experience. The search trigger
 * is LAST and carries `role="search"`: on iOS 26 that renders as the separated
 * accessory docked at the trailing edge of the floating bar, which is the
 * platform's own answer to this design — nothing here is hand-rolled.
 *
 * The bar's SHAPE is the platform's: the floating capsule, its inset, the
 * highlight, and the search separation are iOS 26's, not ours. Only colour,
 * type and icons are set. `backgroundColor` is DELIBERATELY UNSET — painting
 * it lays an opaque fill over the glass material (platform-idiom's worked
 * example; armillary-expo carries that defect as an open call, this app does
 * not inherit it). `fontSize` is unset for the same reason: tab-bar metrics
 * belong to the platform.
 *
 * Trigger names are the route-group directories — a trigger is not a
 * navigator, it selects one.
 */
export default function AppTabs() {
  const theme = useTheme();
  const chartActive = useSegments().some(segment => segment === '(chart)');
  const label = { fontFamily: families.whyte.book };

  return (
    <NativeTabs
      iconColor={{ default: theme.color.icSecondary, selected: theme.color.icPrimary }}
      labelStyle={{
        default: { ...label, color: theme.color.txTertiary },
        selected: { ...label, color: theme.color.txPrimary },
      }}>
      {hasNativeTimeAccessory && chartActive && <NativeTabs.BottomAccessory>
        <NativeTimeAccessory />
      </NativeTabs.BottomAccessory>}
      {/* Label is provisional: the journal tab's name is explicitly undecided
          (D1) and falls out of the glance's shape, not before it. */}
      <NativeTabs.Trigger name="(journal)">
        <NativeTabs.Trigger.Icon sf={{ default: 'book', selected: 'book.fill' }} md="menu_book" />
        <NativeTabs.Trigger.Label>Journal</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="(chart)">
        <NativeTabs.Trigger.Icon
          sf={{ default: 'circle.hexagongrid', selected: 'circle.hexagongrid.fill' }}
          md="donut_large"
        />
        <NativeTabs.Trigger.Label>Chart</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      {/* Last, and role="search" — both are required for the separated
          accessory. Icon and title are the system's; custom labels are
          refused by the platform on a role tab. */}
      <NativeTabs.Trigger name="(search)" role="search" />
    </NativeTabs>
  );
}
