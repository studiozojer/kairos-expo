import { useMemo } from 'react';
import { View, useWindowDimensions } from 'react-native';

import { useTheme } from '@/theme';
import { buildConfiguration } from '@/features/chart/config/buildConfiguration';
import type { ChartCalculationResponse } from '@/features/chart/config/engine-types';
import chart from '@/features/chart/fixtures/engine/sibly-1776.json';
import classic from '@/features/chart/fixtures/presets/classic.json';
import { ChartWheel } from '@/features/chart/render/ChartWheel';
import { parsePreset } from '@/features/chart/schema/preset';

/**
 * The chart tab — the interactive experience users know, ported deliberately.
 *
 * Stage 1 premise slice: the Skia wheel shell (Task 8) over the canned
 * sibly-1776 engine response + the classic preset. Chart data plumbing
 * (live engine, time scrubbing) is deliberately not here yet.
 */
export default function ChartHome() {
  const theme = useTheme();
  const { width } = useWindowDimensions();

  // PINNED (do not inline): buildConfiguration returns a fresh object per
  // call, and ChartWheel's layout memo keys on config identity — an unpinned
  // config re-lays-out every render. Memoize on the fixture+preset inputs.
  const config = useMemo(
    () => buildConfiguration(chart as ChartCalculationResponse, parsePreset(classic)),
    [],
  );

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.color.bgSolidBase,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <ChartWheel config={config} size={width} />
    </View>
  );
}
