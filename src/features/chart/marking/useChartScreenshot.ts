import { useRef, useState, type RefObject } from 'react';
import { Alert, type View } from 'react-native';
import { captureRef, releaseCapture } from 'react-native-view-shot';
import { isAvailableAsync, shareAsync } from 'expo-sharing';

/** Native sharing owns export destinations; never saves into Photos silently. */
export function useChartScreenshot(view: RefObject<View | null>) {
  const busy = useRef(false);
  const [capturing, setCapturing] = useState(false);
  const capture = async () => {
    if (busy.current || !view.current) return;
    busy.current = true; setCapturing(true);
    let uri: string | undefined;
    try {
      if (!await isAvailableAsync()) throw new Error('Sharing is unavailable on this device.');
      // Let the released button and marking backdrop disappear before capture.
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      uri = await captureRef(view, { format: 'png', result: 'tmpfile', handleGLSurfaceViewOnAndroid: true });
      await shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: 'Share chart' });
    } catch (error) {
      Alert.alert('Couldn’t share chart', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      if (uri) releaseCapture(uri);
      busy.current = false; setCapturing(false);
    }
  };
  return { capturing, capture };
}
