import { useCallback, useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import { ChartSheet, SheetHeader } from '../components/ChartSheet';
import { Action, Note } from '../display/controls';
import { Alert, FlatList, View } from 'react-native';
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
  const [group, setGroup] = useState<string[] | null>(null);
  const tap = useCallback((id: string | null) => {
    const target = targets.find(t => t.id === id);
    if (target?.kind === 'starGroup') setGroup(target.members ?? []);
    else setSelected(old => toggleSelection(old, id));
  }, [setSelected,targets]);
  const hold = useCallback((id: string) => {
    const target = targets.find(t => t.id === id);
    if (!target) return;
    if (target.kind === 'star') { Alert.alert(target.label,target.detail); return; }
    if (target.kind !== 'body') { tap(id); if (target.kind === 'segment') Alert.alert(target.label, target.detail); return; }
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
    <ChartSheet visible={group !== null} onClose={() => setGroup(null)}>
      <SheetHeader title="Nearby stars" closeLabel="Close nearby stars" onClose={() => setGroup(null)} />
      <FlatList data={targets.filter(t => group?.includes(t.id))} keyExtractor={target => target.id} contentContainerStyle={{ padding: 24 }}
        ListHeaderComponent={<Note>These stars share a marker. Choose one to select it at its true longitude.</Note>}
        renderItem={({item:target}) => <View><Action label={target.label} onPress={() => { setSelected(old => toggleSelection(old,target.id)); setGroup(null); }} /><Note>{target.detail}</Note></View>} />
    </ChartSheet>
  </View>;
}
