import { StyleSheet } from 'react-native';
import { Canvas, LinearGradient, Rect, vec } from '@shopify/react-native-skia';
import Animated, { Easing, interpolateColor, ReduceMotion, useAnimatedStyle, useDerivedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { PutAwayIcon } from './PutAwayIcon';
import { putAwayCenter } from './cardDrop';
import type { CardDragSession } from './useCardDragSession';

/** Screen-scoped so its fade survives removing the final card. The overlay is
 * decorative: the finger's lower-half hit test lives on the UI thread. */
export function ChartPutAwayOverlay({ session, stepperTop }: { session: CardDragSession; stepperTop: number }) {
  const t = useTheme();
  const { dragging, armed, reducedMotion, viewport: { width, height } } = session;
  // Follow live system changes as well as the setting at process launch.
  const progress = useDerivedValue(() => withSpring(armed.value ? 1 : 0, { duration: 300, dampingRatio: 0.6, reduceMotion: reducedMotion.value ? ReduceMotion.Always : ReduceMotion.Never }));
  const visibility = useAnimatedStyle(() => ({ opacity: withTiming(dragging.value ? 1 : 0, { duration: 200, easing: Easing.inOut(Easing.ease), reduceMotion: reducedMotion.value ? ReduceMotion.Always : ReduceMotion.Never }) }));
  const circle = useAnimatedStyle(() => ({ backgroundColor: interpolateColor(progress.value, [0, 1], [t.color.icPrimary, t.color.icError]) }));
  const normalIcon = useAnimatedStyle(() => ({ opacity: 1 - progress.value }));
  const armedIcon = useAnimatedStyle(() => ({ opacity: progress.value }));
  return <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    style={[StyleSheet.absoluteFill, { zIndex: 5 }, visibility]}>
    <Canvas style={StyleSheet.absoluteFill}>
      <Rect x={0} y={height / 2} width={width} height={height / 2}>
        <LinearGradient start={vec(0, height / 2)} end={vec(0, height)} colors={['#00000000', '#0000004d', '#00000080']} />
      </Rect>
    </Canvas>
    <Animated.View style={[{ position: 'absolute', left: width / 2 - 35, top: putAwayCenter(height, stepperTop) - 35,
      width: 70, height: 70, borderRadius: 35, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 5, alignItems: 'center', justifyContent: 'center' }, circle]}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.icon, normalIcon]}><PutAwayIcon color={t.color.icError} /></Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, styles.icon, armedIcon]}><PutAwayIcon color={t.color.icWhite} /></Animated.View>
    </Animated.View>
  </Animated.View>;
}
const styles = StyleSheet.create({ icon: { alignItems: 'center', justifyContent: 'center' } });
