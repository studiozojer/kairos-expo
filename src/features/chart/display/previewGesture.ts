import { Animated } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';

/** Native recognizers hold per-touch state outside React's render lifecycle. */
export function previewGesture(cover: Animated.Value, previewHeight: number, commit: (position: number) => void) {
        const start = { height: 0, y: 0 };
        const clamp = (value: number) => Math.max(0, Math.min(previewHeight, value));
        const finish = (value: number) => {
            const position = clamp(value);
            cover.setValue(position);
            commit(position);
        };
        // Claim the handle with a native recognizer before the sheet's pan can
        // take it. Absolute coordinates stay stable while the handle itself moves.
        const pan = Gesture.Pan().withTestId('preview-pan').minDistance(2).runOnJS(true)
            .onBegin(event => {
                start.y = event.absoluteY;
                cover.stopAnimation(value => { start.height = value; });
            })
            .onUpdate(event => cover.setValue(clamp(start.height + event.absoluteY - start.y)))
            .onEnd((event, success) => {
                if (success) finish(start.height + event.absoluteY - start.y);
                else cover.stopAnimation(finish);
            });
        const tap = Gesture.Tap().withTestId('preview-tap').maxDistance(2).runOnJS(true)
            .onEnd((_, success) => {
                if (success) cover.stopAnimation(value => finish(value > 0 ? 0 : previewHeight));
            });
        return Gesture.Race(pan, tap);
}
