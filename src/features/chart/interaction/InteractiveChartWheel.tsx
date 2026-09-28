import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { Alert, View } from 'react-native';
import { GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import type { ChartRenderingConfiguration } from '../config/ChartRenderingConfiguration';
import type { SelectionStyleOverride } from '../schema/preset';
import { ChartWheelCanvas } from '../render/ChartWheel';
import { useWheelLayout } from '../render/useWheelLayout';
import { chartTargets, selectionPaint, toggleSelection } from './selection';
import { useChartGesture } from './useChartGesture';

/** Native touch recognition feeds Mercurial-derived UI-thread transforms.
 * The native alert owns presentation; chart-specific motion and
 * hit detection are custom because there is no platform chart interaction. */
export function InteractiveChartWheel({ config, size, selectionStyle, enabled = true, onHideBody, viewport, baseCenter, selectedIds, onSelectionChange }: {
  config: ChartRenderingConfiguration; size: number; selectionStyle: SelectionStyleOverride;
  viewport: { width: number; height: number }; baseCenter: { x: number; y: number };
  selectedIds?: string[]; onSelectionChange?: Dispatch<SetStateAction<string[]>>;
  enabled?: boolean; onHideBody: (name: string) => void;
}) {
  const layout = useWheelLayout(config, size);
  const targets = useMemo(() => chartTargets(layout), [layout]);
  const [localSelected, setLocalSelected] = useState<string[]>([]);
  const selected = selectedIds ?? localSelected;
  const setSelected = useCallback((ids: SetStateAction<string[]>) => {
    if (onSelectionChange) onSelectionChange(ids); else setLocalSelected(ids);
  }, [onSelectionChange]);
  // IDs persist through time steps; hit positions are always
  // derived from the currently rendered chart. Hiding a body drops selection.
  useEffect(() => {
    const visible = new Set(targets.map(t => t.id));
    // Controlled selection belongs to the page: notify it after commit, never
    // update the parent while rendering this wheel. The guard prevents loops.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (selected.some(id => !visible.has(id))) setSelected(old => old.filter(id => visible.has(id)));
  }, [targets, selected, setSelected]);
  const paint = useMemo(() => selectionPaint(selected, targets, config, selectionStyle), [selected, targets, config, selectionStyle]);
  const tap = useCallback((id: string | null) => setSelected(old => toggleSelection(old, id)), [setSelected]);
  const hold = useCallback((id: string) => {
    const target = targets.find(t => t.id === id);
    if (!target) return;
    if (target.kind !== 'body') { tap(id); return; }
    Alert.alert(target.label, target.detail, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Hide from chart', onPress: () => onHideBody(target.label) },
    ]);
  }, [targets, tap, onHideBody]);
  const motion = useChartGesture(size, targets, enabled, tap, hold, baseCenter);
  return <View style={{ position: 'absolute', top: 0, left: 0, width: viewport.width, height: viewport.height }}>
    <GestureHandlerRootView style={{ width: viewport.width, height: viewport.height }}>
      <GestureDetector gesture={motion.gesture}>
        <View testID="interactive-chart" accessible={false} collapsable={false} style={{ width: viewport.width, height: viewport.height }}>
          <ChartWheelCanvas config={config} size={size} layout={layout} viewport={viewport} selection={paint} animatedTransform={motion.animatedTransform} />
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  </View>;
}
