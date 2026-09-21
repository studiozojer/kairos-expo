import { useState } from 'react';
import { Pressable, Text, View, useWindowDimensions, type ViewProps } from 'react-native';
import { MenuView, type MenuAction } from '@react-native-menu/menu';
import { GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useTheme } from '@/theme';
import { useActiveCharts, type ActiveCalculation } from './ActiveChartsContext';
import { chartDateLabel } from './wallTime';
import type { ActiveChart } from './model';
import { useCardDrag } from './useCardDrag';

const GAP = 8;
function CardFace({ chart, index, count, selected, calculation }: {
  chart: ActiveChart; index: number; count: number; selected: boolean; calculation?: ActiveCalculation;
}) {
  const t = useTheme();
  const timezone = chart.settings.location.timezone;
  const date = new Intl.DateTimeFormat(undefined, { timeZone: timezone, year: 'numeric', month: 'short', day: 'numeric' }).format(chart.time);
  const time = new Intl.DateTimeFormat(undefined, { timeZone: timezone, hour: 'numeric', minute: '2-digit' }).format(chart.time);
  return <View pointerEvents="none" style={{ flex: 1, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 6,
    borderWidth: 1, borderColor: selected ? t.color.bdAccent : t.color.bdSecondary, backgroundColor: t.color.bgSolidCardSecondary }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <Text numberOfLines={1} style={[t.type.whyteSm, { flex: 1, color: t.color.txPrimary }]}>{chart.name}</Text>
      <Text style={[t.type.fraktionXxs, { color: selected ? t.color.txAccent : t.color.txTertiary }]}>{count > 1 ? index + 1 : ''}{selected ? '•' : ''}</Text>
    </View>
    <Text numberOfLines={1} style={[t.type.fraktionXs, { color: t.color.txSecondary, marginTop: 4 }]}>{date}</Text>
    <Text numberOfLines={1} style={[t.type.fraktionXs, { color: t.color.txSecondary }]}>{time}</Text>
    <Text numberOfLines={1} style={[t.type.fraktionXs, { color: calculation?.status === 'error' ? t.color.txAccent : t.color.txTertiary }]}>
      {calculation?.status === 'loading' ? 'Updating…' : calculation?.status === 'error' ? 'Calculation failed' : chart.settings.location.name}
    </Text>
  </View>;
}

function CardSlot({ chart, index, ids, width, height, dragging, target }: {
  chart: ActiveChart; index: number; ids: string[]; width: number; height: number;
  dragging: SharedValue<string>; target: SharedValue<number>;
}) {
  const state = useActiveCharts();
  const t = useTheme();
  const selected = chart.id === state.targetId;
  const { gesture, x, y } = useCardDrag({ id: chart.id, index, ids, width, height, gap: GAP, dragging, target, onDrop: state.moveTo });
  const slotStyle = useAnimatedStyle(() => ({ zIndex: dragging.value === chart.id ? 10 : 0 }));
  const liftStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }, { scale: dragging.value === chart.id ? 1.05 : 1 }],
    shadowOpacity: dragging.value === chart.id ? 0.2 : 0,
  }));
  const insertionStyle = useAnimatedStyle(() => {
    const source = ids.indexOf(dragging.value);
    const highlighted = target.value === index && source >= 0 && source !== index;
    return { opacity: highlighted ? 1 : 0, left: source > index ? -4 : undefined, right: source < index ? -4 : undefined };
  });
  const face = <CardFace chart={chart} index={index} count={ids.length} selected={selected} calculation={state.calculations[chart.id]} />;
  return <Animated.View style={[{ flex: 1, height, minWidth: 0 }, slotStyle]}>
    <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flex: 1, opacity: 0.25 }}>{face}</View>
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: 0, bottom: 0, width: 3, borderRadius: 2, backgroundColor: t.color.txAccent }, insertionStyle]} />
    <GestureDetector gesture={gesture}>
      <Animated.View style={[{ position: 'absolute', inset: 0, shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowRadius: 10, elevation: 2 }, liftStyle]}>
        <Pressable accessibilityRole="radio" accessibilityLabel={`Step ${chart.name}, ring ${index + 1}`}
          accessibilityState={{ checked: selected }}
          accessibilityValue={{ text: chartDateLabel(chart.time, chart.settings.location.timezone) }}
          accessibilityHint="Tap to choose the time stepper target. Drag to another card to reorder rings. Chart actions are below the row."
          accessibilityActions={[{ name: 'activate', label: 'Select stepper target' },
            ...(index > 0 ? [{ name: 'inward', label: 'Move inward' }] : []),
            ...(index < ids.length - 1 ? [{ name: 'outward', label: 'Move outward' }] : []), { name: 'remove', label: 'Remove from wheel' }]}
          onAccessibilityAction={({ nativeEvent: { actionName } }) => {
            if (actionName === 'activate') state.selectTarget(chart.id);
            if (actionName === 'inward') state.move(chart.id, -1);
            if (actionName === 'outward') state.move(chart.id, 1);
            if (actionName === 'remove') state.remove(chart.id);
          }}
          onPress={() => state.selectTarget(chart.id)} style={{ flex: 1 }}>
          {face}
        </Pressable>
      </Animated.View>
    </GestureDetector>
  </Animated.View>;
}

/** Swift's fitted active row: every card is visible, slots indicate ring order,
 * and only a completed drop changes membership order. Secondary actions use the
 * platform's anchored menu instead of filling each card with buttons. */
export function ActiveChartCards() {
  const state = useActiveCharts();
  const router = useRouter();
  const t = useTheme();
  const { fontScale } = useWindowDimensions();
  const [width, setWidth] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const dragging = useSharedValue(''), target = useSharedValue(-1);
  const ids = state.active.map(chart => chart.id);
  const selectedIndex = state.active.findIndex(chart => chart.id === state.targetId);
  const selected = state.active[selectedIndex];
  const height = Math.ceil(100 * Math.max(1, fontScale));
  const openLibrary = () => router.push('/charts');
  const actions: MenuAction[] = [
    ...(selectedIndex > 0 ? [{ id: 'inward', title: 'Move inward' }] : []),
    ...(selectedIndex >= 0 && selectedIndex < ids.length - 1 ? [{ id: 'outward', title: 'Move outward' }] : []),
    ...(selected ? [{ id: 'reset', title: selected.kind === 'now' ? 'Reset to now' : 'Reset time' },
      ...(state.calculations[selected.id]?.status === 'error' ? [{ id: 'retry', title: 'Retry calculation' }] : []),
      { id: 'remove', title: 'Remove from wheel', attributes: { destructive: true } }] : []),
    { id: 'library', title: 'Add / saved charts' },
    { id: 'collapse', title: collapsed ? 'Show cards' : 'Hide cards' },
  ];
  const menuAccessibility: Pick<ViewProps, 'accessible' | 'accessibilityRole' | 'accessibilityLabel'> = {
    accessible: true, accessibilityRole: 'button', accessibilityLabel: 'Chart actions',
  };
  return <GestureHandlerRootView style={{ zIndex: 10, paddingHorizontal: t.space.md, paddingTop: t.space.sm }}>
    {(!collapsed || !ids.length) && <View style={{ flexDirection: 'row', alignItems: 'center', gap: GAP }}>
      {!!ids.length && <View testID="active-card-slots" onLayout={event => setWidth(event.nativeEvent.layout.width)} style={{ flex: 1, flexDirection: 'row', gap: GAP }}>
        {state.active.map((chart, index) => <CardSlot key={chart.id} chart={chart} index={index} ids={ids} width={width} height={height} dragging={dragging} target={target} />)}
      </View>}
      {ids.length < 3 && <Pressable accessibilityRole="button" accessibilityLabel="Add / saved charts" onPress={openLibrary}
        style={{ minWidth: 44, minHeight: 44, flex: ids.length ? undefined : 1, alignItems: 'center', justifyContent: 'center', borderRadius: 6, backgroundColor: t.color.bgSolidCardSecondary }}>
        <Text style={[t.type.whyteMd, { color: t.color.txSecondary }]}>{ids.length ? '+' : '+  Add chart to view'}</Text>
      </Pressable>}
    </View>}
    {!!ids.length && <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      {collapsed ? <Pressable accessibilityRole="button" onPress={() => setCollapsed(false)} style={{ minHeight: 44, justifyContent: 'center' }}>
        <Text style={[t.type.whyteXs, { color: t.color.txAccent }]}>Show cards</Text>
      </Pressable> : <Text style={[t.type.fraktionXxs, { flex: 1, color: t.color.txTertiary }]}>
        {state.active.some(chart => state.calculations[chart.id]?.result && state.calculations[chart.id]?.status !== 'ready') ? 'Showing previous positions while updating' : ids.length > 1 ? 'Drag to arrange · Tap to step' : 'Tap card to step'}
      </Text>}
      <MenuView {...menuAccessibility} title={selected ? `${selected.name} · Ring ${selectedIndex + 1}` : 'Charts'} themeVariant={t.scheme}
        shouldOpenOnLongPress={false} isAnchoredToRight actions={actions} style={{ minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center' }}
        onPressAction={({ nativeEvent: { event } }) => {
          if (event === 'library') openLibrary();
          if (event === 'collapse') setCollapsed(value => !value);
          if (!selected) return;
          if (event === 'inward') state.move(selected.id, -1);
          if (event === 'outward') state.move(selected.id, 1);
          if (event === 'reset') state.reset();
          if (event === 'retry') state.calculations[selected.id]?.retry();
          if (event === 'remove') state.remove(selected.id);
        }}>
        <Text pointerEvents="none" style={[t.type.whyteMd, { color: t.color.txSecondary }]}>···</Text>
      </MenuView>
    </View>}
  </GestureHandlerRootView>;
}
