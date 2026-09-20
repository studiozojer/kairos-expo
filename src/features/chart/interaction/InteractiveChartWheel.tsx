import { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useTheme } from '@/theme';
import type { ChartRenderingConfiguration } from '../config/ChartRenderingConfiguration';
import type { SelectionStyleOverride } from '../schema/preset';
import { ChartWheelCanvas } from '../render/ChartWheel';
import { useWheelLayout } from '../render/useWheelLayout';
import { ChartSheet, SheetHeader } from '../components/ChartSheet';
import { chartTargets, selectionPaint, toggleSelection } from './selection';
import { useChartGesture } from './useChartGesture';

/** Native touch recognition feeds Mercurial-derived UI-thread transforms.
 * The native sheet and alert own presentation; chart-specific motion and
 * hit detection are custom because there is no platform chart interaction. */
export function InteractiveChartWheel({ config, size, selectionStyle, enabled = true, onHideBody }: {
  config: ChartRenderingConfiguration; size: number; selectionStyle: SelectionStyleOverride;
  enabled?: boolean; onHideBody: (name: string) => void;
}) {
  const theme = useTheme();
  const layout = useWheelLayout(config, size);
  const targets = useMemo(() => chartTargets(layout), [layout]);
  const [selected, setSelected] = useState<string[]>([]);
  const [objectsOpen, setObjectsOpen] = useState(false);
  // IDs persist through time steps; display text and hit positions are always
  // derived from the currently rendered chart. Hiding a body drops selection.
  const [previousTargets, setPreviousTargets] = useState(targets);
  if (previousTargets !== targets) {
    setPreviousTargets(targets);
    const visible = new Set(targets.map(t => t.id));
    if (selected.some(id => !visible.has(id))) setSelected(selected.filter(id => visible.has(id)));
  }
  const paint = useMemo(() => selectionPaint(selected, targets, config, selectionStyle), [selected, targets, config, selectionStyle]);
  const selectedTargets = selected.flatMap(id => { const target = targets.find(t => t.id === id); return target ? [target] : []; });
  const tap = useCallback((id: string | null) => setSelected(old => toggleSelection(old, id)), []);
  const hold = useCallback((id: string) => {
    const target = targets.find(t => t.id === id);
    if (!target) return;
    if (target.kind !== 'body') { tap(id); return; }
    Alert.alert(target.label, target.detail, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Hide from chart', onPress: () => onHideBody(target.label) },
    ]);
  }, [targets, tap, onHideBody]);
  const motion = useChartGesture(size, targets, enabled && !objectsOpen, tap, hold);
  const button = (label: string, action: () => void) => <Pressable key={label} accessibilityRole="button"
    accessibilityLabel={label} onPress={action} disabled={!enabled}
    style={{ minHeight: 44, minWidth: 44, justifyContent: 'center', paddingHorizontal: 8 }}>
    <Text style={[theme.type.whyteXs, { color: theme.color.txAccent }]}>{label}</Text>
  </Pressable>;

  return <View style={{ width: '100%', alignItems: 'center' }}>
    <GestureHandlerRootView>
      <GestureDetector gesture={motion.gesture}>
        <View testID="interactive-chart" accessible={false} collapsable={false} style={{ width: size, height: size }}>
          <ChartWheelCanvas config={config} size={size} layout={layout} selection={paint} animatedTransform={motion.animatedTransform} />
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
    <View style={{ flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap' }}>
      {button('Chart objects', () => setObjectsOpen(true))}
      {button('Zoom out', () => motion.zoom(-1))}
      {button('Zoom in', () => motion.zoom(1))}
      {button('Reset view', motion.reset)}
    </View>
    <View style={{ minHeight: 44, paddingHorizontal: theme.space.md }}>
      {selectedTargets.length ? <Pressable accessibilityRole="button" accessibilityLabel={`Selection: ${selectedTargets.map(t => `${t.label}, ${t.detail}`).join('; ')}. Open chart objects.`}
        onPress={() => setObjectsOpen(true)} style={{ minHeight: 44, justifyContent: 'center' }}>
        <Text numberOfLines={2} style={[theme.type.fraktionXxs, { color: theme.color.txPrimary, textAlign: 'center' }]}>
          {selectedTargets.map(t => `${t.label} · ${t.detail}`).join('\n')}
        </Text>
      </Pressable> : <Text style={[theme.type.fraktionXxs, { color: theme.color.txTertiary, textAlign: 'center' }]}>
        Pinch to zoom · Tap to select
      </Text>}
    </View>
    <ChartSheet visible={objectsOpen} onClose={() => setObjectsOpen(false)}>
      <SheetHeader title="Chart objects" closeLabel="Close chart objects" onClose={() => setObjectsOpen(false)}
        trailing={button('Clear', () => setSelected([]))} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: theme.space.lg, paddingBottom: 32 }}>
        {targets.map(target => <View key={target.id} style={{ flexDirection: 'row', alignItems: 'center', borderBottomWidth: theme.border.hairline, borderColor: theme.color.bdSecondary }}>
          <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: paint.selected.has(target.id) }}
            accessibilityLabel={`${target.label}, ${target.detail}`} onPress={() => tap(target.id)}
            style={{ flex: 1, minHeight: 60, justifyContent: 'center', paddingVertical: 8 }}>
            <Text style={[theme.type.whyteSm, { color: theme.color.txPrimary }]}>{paint.selected.has(target.id) ? '✓ ' : ''}{target.label}</Text>
            <Text style={[theme.type.fraktionXxs, { color: theme.color.txSecondary }]}>{target.detail}</Text>
          </Pressable>
          {target.kind === 'body' && <Pressable accessibilityRole="button" accessibilityLabel={`Actions for ${target.label}`}
            onPress={() => hold(target.id)} style={{ minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={[theme.type.whyteSm, { color: theme.color.txAccent }]}>···</Text>
          </Pressable>}
        </View>)}
      </ScrollView>
    </ChartSheet>
  </View>;
}
