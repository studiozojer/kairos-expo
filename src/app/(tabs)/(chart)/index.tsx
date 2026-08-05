import { Text, View } from 'react-native';

import { useTheme } from '@/theme';

/**
 * The chart tab — the interactive experience users know, ported deliberately.
 *
 * Nothing is drawn here yet on purpose. Stage 1 is the premise slice: a Skia
 * wheel on real engine data, time scrubbed by gesture, built to be thrown
 * away. It proves the sentence the whole repo rests on — RN can deliver the
 * chart feel — before any foundation accumulates beneath it. The port then
 * walks, Stages 2+; it is never one-shotted.
 */
export default function ChartHome() {
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
        The wheel is proven before it is ported.
      </Text>
      <Text style={{ ...theme.type.body, color: theme.color.txSecondary, textAlign: 'center' }}>
        Stage 1 — the premise slice.{'\n'}Skia, real ephemeris, a scrubbed hour.
      </Text>
    </View>
  );
}
