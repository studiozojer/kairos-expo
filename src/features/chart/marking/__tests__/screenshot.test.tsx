import { useEffect } from 'react';
import { act, create } from 'react-test-renderer';
import { Alert, type View } from 'react-native';
import { captureRef, releaseCapture } from 'react-native-view-shot';
import { isAvailableAsync, shareAsync } from 'expo-sharing';
import { useChartScreenshot } from '../useChartScreenshot';
jest.mock('react-native-view-shot', () => ({ captureRef: jest.fn(), releaseCapture: jest.fn() }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));
let hook: ReturnType<typeof useChartScreenshot>;
const ref = { current: {} as View };
function Probe() { const result = useChartScreenshot(ref); useEffect(() => { hook = result; }); return null; }
beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(global, 'requestAnimationFrame').mockImplementation(cb => { cb(0); return 1; });
  jest.mocked(isAvailableAsync).mockResolvedValue(true);
  jest.mocked(captureRef).mockResolvedValue('file:///tmp/chart.png');
  jest.mocked(shareAsync).mockResolvedValue(undefined);
});
afterEach(() => jest.restoreAllMocks());
test('captures once for simultaneous taps, shares PNG, and releases the temporary file', async () => {
  let view!: ReturnType<typeof create>;
  act(() => { view = create(<Probe />); });
  await act(async () => { await Promise.all([hook.capture(), hook.capture()]); });
  expect(captureRef).toHaveBeenCalledTimes(1);
  expect(shareAsync).toHaveBeenCalledWith('file:///tmp/chart.png', expect.objectContaining({ mimeType: 'image/png' }));
  expect(releaseCapture).toHaveBeenCalledWith('file:///tmp/chart.png');
  expect(hook.capturing).toBe(false);
  act(() => view.unmount());
});
test('sharing failures release the image and show a usable error', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest.mocked(shareAsync).mockRejectedValue(new Error('Share failed'));
  let view!: ReturnType<typeof create>;
  act(() => { view = create(<Probe />); });
  await act(async () => hook.capture());
  expect(releaseCapture).toHaveBeenCalledWith('file:///tmp/chart.png');
  expect(alert).toHaveBeenCalledWith('Couldn’t share chart', 'Share failed');
  expect(hook.capturing).toBe(false);
  act(() => view.unmount());
});
