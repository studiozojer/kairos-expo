/* Gesture callbacks access refs only when native events fire, never during render. */
/* eslint-disable react-hooks/refs */
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, AppState, Platform, StyleSheet, Text, View } from 'react-native';
import { BlurTargetView, BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, withSpring, ReduceMotion } from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { DIRECTIONS, MarkingMenuController, type MarkingOption, type MenuSession } from './markingMenuState';

export interface MarkingMenuOption extends MarkingOption { icon: ReactNode }
interface MenuContext {
  controller: MarkingMenuController; session: MenuSession | null; enabled: boolean; reduced: boolean;
}
const Context = createContext<MenuContext | null>(null);
const EMPTY: readonly MarkingMenuOption[] = [];
function haptic() { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); }

/** Root visual overlay keeps the radial menu above wheel, cards and stepper.
 * Native recognizers own the touch; no modal replaces them mid-gesture. */
export function MarkingMenuProvider({ children, enabled = true, onActiveChange }: {
  children: ReactNode; enabled?: boolean; onActiveChange?: (active: boolean) => void;
}) {
  const theme = useTheme();
  const [session, setSession] = useState<MenuSession | null>(null);
  const [controller] = useState(() => new MarkingMenuController(setSession));
  const [reduced, setReduced] = useState(false);
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  const root = useRef<View>(null), blurTarget = useRef<View>(null);
  useEffect(() => { controller.setEnabled(enabled); }, [enabled, controller]);
  const isActive = !!session;
  useEffect(() => { onActiveChange?.(isActive); }, [isActive, onActiveChange]); // only ownership changes affect the chart
  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => { if (alive) setReduced(value); });
    const motion = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    const app = AppState.addEventListener('change', state => { if (state !== 'active') controller.cancel(); });
    return () => { alive = false; motion.remove(); app.remove(); controller.dispose(); };
  }, [controller]);
  const center = session && { x: session.center.x - origin.x, y: session.center.y - origin.y };
  return <Context.Provider value={{ controller, session, enabled, reduced }}>
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View ref={root} collapsable={false} style={{ flex: 1 }} onLayout={() => {
        controller.cancel(); root.current?.measureInWindow((x, y) => setOrigin({ x, y }));
      }}>
        <BlurTargetView ref={blurTarget} style={{ flex: 1 }}>{children}</BlurTargetView>
        {session?.shown && center && <View testID="marking-menu-overlay" pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={StyleSheet.absoluteFill}>
          <BlurView intensity={15} tint="systemUltraThinMaterial" blurTarget={blurTarget} blurMethod="dimezisBlurViewSdk31Plus" style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.color.bgSolidBase, opacity: .1 }]} />
          <View style={{ position: 'absolute', left: center.x - 100, top: center.y - 100, width: 200, height: 200, borderRadius: 100, backgroundColor: theme.color.txAccent, opacity: .1 }} />
          <View style={{ position: 'absolute', left: center.x - 100, top: center.y - 100, width: 200, height: 200, borderRadius: 100, borderWidth: 2, borderColor: theme.color.txAccent, opacity: .3 }} />
          <View style={{ position: 'absolute', left: center.x - 22, top: center.y - 22, width: 44, height: 44,
            alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: theme.color.bgPressed,
            transform: [{ scale: reduced ? 1 : 1.1 }] }}>{session.centerContent}</View>
          {(session.options as readonly MarkingMenuOption[]).map(option => {
            const angle = DIRECTIONS.indexOf(option.position) * Math.PI / 4;
            const highlighted = option.id === session.highlighted;
            return <View key={option.id} style={{ position: 'absolute', left: center.x + 100 * Math.cos(angle) - 44, top: center.y + 100 * Math.sin(angle) - 22, width: 88, alignItems: 'center', opacity: option.disabled ? .35 : 1, transform: [{ scale: highlighted && !reduced ? 1.15 : 1 }] }}>
              <View style={{ width: 44, height: 44, borderRadius: 22, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: highlighted ? theme.color.txAccent : theme.color.bgSolidCardSecondary }}>{option.icon}</View>
              <Text numberOfLines={2} style={[theme.type.fraktionXs, { color: theme.color.txPrimary, textAlign: 'center', marginTop: 4 }]}>{option.label}</Text>
            </View>;
          })}
        </View>}
      </View>
    </GestureHandlerRootView>
  </Context.Provider>;
}

export function MarkingMenuButton({ id, label, hint, disabled = false, onPress, options = EMPTY, children }: {
  id: string; label: string; hint?: string; disabled?: boolean; onPress?: () => void;
  options?: readonly MarkingMenuOption[]; children: ReactNode;
}) {
  const context = useContext(Context);
  if (!context) throw new Error('MarkingMenuButton requires MarkingMenuProvider');
  const { controller, session, enabled, reduced } = context;
  const theme = useTheme();
  const token = useRef<number | undefined>(undefined);
  const allowed = enabled && !disabled;
  const liveAllowed = useRef(allowed);
  const active = session?.owner === id;
  useEffect(() => { liveAllowed.current = allowed; if (!allowed) controller.cancelOwner(id); }, [allowed, controller, id]);
  useEffect(() => () => controller.cancelOwner(id), [controller, id]);
  const activate = () => { if (liveAllowed.current && !controller.current) onPress?.(); };
  const gesture = Gesture.Pan().withTestId(`marking-${id}`).minDistance(0).maxPointers(1).enabled(allowed).runOnJS(true)
    .onBegin(event => {
      if (!liveAllowed.current) return;
      token.current = controller.begin(id, { x: event.absoluteX - event.x + 22, y: event.absoluteY - event.y + 22 }, options, onPress, children);
      if (token.current !== undefined) haptic();
    })
    .onUpdate(event => controller.update(token.current, event.translationX, event.translationY))
    .onEnd((event, success) => { if (success && liveAllowed.current) controller.end(token.current, event.translationX, event.translationY); })
    .onFinalize(() => { if (token.current !== undefined) controller.cancel(token.current); token.current = undefined; });
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(active ? 1.1 : 1, { duration: 150, dampingRatio: .7, reduceMotion: reduced ? ReduceMotion.Always : ReduceMotion.Never }) }],
  }));
  return <GestureDetector gesture={gesture}>
    <Animated.View accessible accessibilityRole="button" accessibilityLabel={label} accessibilityHint={hint}
      accessibilityState={{ disabled: !allowed }} onAccessibilityTap={activate}
      accessibilityActions={[{ name: 'activate' }, ...options.filter(o => !o.disabled).map(o => ({ name: o.id, label: o.label }))]}
      onAccessibilityAction={event => {
        if (!liveAllowed.current || controller.current) return;
        if (event.nativeEvent.actionName === 'activate') activate();
        else options.find(o => !o.disabled && o.id === event.nativeEvent.actionName)?.onSelect();
      }}
      // Web has no native accessibility activation callback.
      {...(Platform.OS === 'web' ? { onClick: activate } : {})}
      style={[{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: active ? theme.color.bgPressed : 'transparent', opacity: allowed ? 1 : .35 }, style]}>
      <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ opacity: active && session.shown ? 0 : 1 }}>{children}</View>
    </Animated.View>
  </GestureDetector>;
}
