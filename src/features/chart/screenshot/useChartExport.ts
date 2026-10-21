import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Alert, Linking } from 'react-native';
import { isAvailableAsync, shareAsync } from 'expo-sharing';
import { renderChartExport, releaseChartExport, chartExportSize } from './renderExport';
import { ensurePhotoPermission, PhotoPermissionError, saveChartToPhotos } from './photos';
import { exportLayout, snapshotExport, type ChartExportSnapshot, type ExportRequest } from './model';

function cancelled() { return new Error('Export cancelled'); }

/** One operation owns the snapshot, temporary file and destination.
 * The ref lock closes the gap before React commits the disabled controls. */
export function useChartExport(getSnapshot: () => ChartExportSnapshot | null, enabled = true) {
  const live = useRef({ getSnapshot, enabled });
  useLayoutEffect(() => { live.current = { getSnapshot, enabled }; });
  const busy = useRef(false), mounted = useRef(true);
  const abort = useRef<AbortController | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [capturing, setCapturing] = useState(false);
  const [notice, setNotice] = useState<string>();
  useLayoutEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; abort.current?.abort(); clearTimeout(noticeTimer.current); };
  }, []);
  // Losing the chart screen before capture must not open a share sheet later.
  useEffect(() => { if (!enabled) abort.current?.abort(); }, [enabled]);

  const capture = useCallback(async (request: ExportRequest) => {
    if (busy.current || !mounted.current || !live.current.enabled) return;
    busy.current = true;
    const controller = new AbortController(); abort.current = controller;
    const { signal } = controller;
    setCapturing(true); setNotice(undefined); clearTimeout(noticeTimer.current);
    let uri: string | undefined;
    try {
      const input = live.current.getSnapshot();
      if (!input) throw new Error('Wait for the chart to finish loading before exporting.');
      const snapshot = snapshotExport(input);
      if (request.destination === 'photos') await ensurePhotoPermission();
      else if (!await isAvailableAsync()) throw new Error('Sharing is unavailable on this device.');
      if (signal.aborted) throw cancelled();
      uri = await renderChartExport(snapshot, request.variant, signal);
      if (signal.aborted) throw cancelled();
      const expected = exportLayout(snapshot, request.variant);
      const dimensions = chartExportSize(uri);
      if (dimensions.width !== expected.pixelWidth || dimensions.height !== expected.pixelHeight) {
        throw new Error('The chart image could not be rendered at its full resolution. Please try again.');
      }
      if (signal.aborted) throw cancelled();
      if (request.destination === 'photos') {
        // Once a native Photos write begins, let it complete even after unmount.
        await saveChartToPhotos(uri);
        if (mounted.current && !signal.aborted) {
          setNotice('Saved to Photos'); AccessibilityInfo.announceForAccessibility('Saved to Photos');
          noticeTimer.current = setTimeout(() => { if (mounted.current) setNotice(undefined); }, 4000);
        }
      } else {
        await shareAsync(uri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle: 'Share chart' });
      }
    } catch (error) {
      if (mounted.current && !signal.aborted) {
        if (error instanceof PhotoPermissionError) Alert.alert('Photo access needed', error.message, [
          { text: 'Cancel', style: 'cancel' }, { text: 'Open Settings', onPress: () => { void Linking.openSettings().catch(() => {}); } },
        ]);
        else Alert.alert(request.destination === 'photos' ? 'Couldn’t save chart' : 'Couldn’t share chart', error instanceof Error ? error.message : 'Please try again.');
      }
    } finally {
      if (uri) {
        try { releaseChartExport(uri); } catch { console.warn("Could not remove the temporary chart image."); }
      }
      busy.current = false;
      if (abort.current === controller) abort.current = null;
      if (mounted.current) setCapturing(false);
    }
  }, []);
  return { capturing, capture, notice };
}
