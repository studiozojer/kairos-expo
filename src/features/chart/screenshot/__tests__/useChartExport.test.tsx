import { useEffect } from 'react';
import { act, create } from 'react-test-renderer';
import { Alert } from 'react-native';
import { renderChartExport, releaseChartExport, chartExportSize } from '../renderExport';
import { isAvailableAsync, shareAsync } from 'expo-sharing';
import { useChartExport } from '../useChartExport';
import { ensurePhotoPermission, saveChartToPhotos, PhotoPermissionError } from '../photos';
import { themeFor } from '@/theme';
import { buildConfiguration } from '../../config/buildConfiguration';
import { parsePreset } from '../../schema/preset';
import classic from '../../fixtures/presets/classic.json';
import fixture from '../../fixtures/engine/sibly-1776.json';
import type { ChartCalculationResponse } from '../../config/engine-types';
import type { ChartExportSnapshot } from '../model';

jest.mock('../renderExport', () => ({ renderChartExport: jest.fn(), releaseChartExport: jest.fn(), chartExportSize: jest.fn() }));
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn(), shareAsync: jest.fn() }));
jest.mock('../photos', () => ({ ...jest.requireActual('../photos'), ensurePhotoPermission: jest.fn(), saveChartToPhotos: jest.fn() }));
jest.mock('expo-media-library', () => ({}));
let hook: ReturnType<typeof useChartExport>;
let input: ChartExportSnapshot;
let finishRender: (uri: string) => void;
let failRender: (error: Error) => void;
function Probe({ enabled = true }: { enabled?: boolean }) {
  const result = useChartExport(() => input, enabled);
  useEffect(() => { hook = result; });
  return null;
}
beforeEach(() => {
  jest.useFakeTimers(); jest.clearAllMocks();
  const preset = parsePreset(classic);
  input = { config: buildConfiguration(fixture as ChartCalculationResponse, preset), width: 390, selectedIds: ['sun'], selectionStyle: preset.selection,
    theme: themeFor('light'), cards: [] };
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest.mocked(chartExportSize).mockReturnValue({ width: 2532, height: 2532 });
  jest.mocked(isAvailableAsync).mockResolvedValue(true);
  jest.mocked(renderChartExport).mockImplementation((_snapshot, _variant, signal) => new Promise((resolve,reject) => {
    finishRender = resolve; failRender = reject; signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true });
  }));
  jest.mocked(ensurePhotoPermission).mockResolvedValue(undefined);
  jest.mocked(saveChartToPhotos).mockResolvedValue(undefined);
  jest.mocked(shareAsync).mockResolvedValue(undefined);
});
afterEach(() => { jest.restoreAllMocks(); jest.useRealTimers(); });
function mount() { let view!: ReturnType<typeof create>; act(() => { view = create(<Probe />); }); return view; }
async function ready(view: ReturnType<typeof create>) {
  void view;
  await act(async () => finishRender('file:///tmp/chart.png'));
}
test('shares the rendered PNG, guards simultaneous requests and releases the file', async () => {
  const view = mount(); let running!: Promise<void>;
  await act(async () => { running = hook.capture({ variant: 'wheel', destination: 'share' }); await hook.capture({ variant: 'full', destination: 'photos' }); });
  expect(hook.capturing).toBe(true); expect(renderChartExport).toHaveBeenCalledTimes(1);
  expect(ensurePhotoPermission).not.toHaveBeenCalled();
  await ready(view); await act(async () => running);
  expect(renderChartExport).toHaveBeenCalledTimes(1);
  expect(shareAsync).toHaveBeenCalledWith('file:///tmp/chart.png', expect.objectContaining({ mimeType: 'image/png' }));
  expect(releaseChartExport).toHaveBeenCalledWith('file:///tmp/chart.png'); expect(hook.capturing).toBe(false);
  act(() => view.unmount());
});
test('freezes snapshot before the Photos permission prompt and confirms completed album save', async () => {
  let allow!: () => void;
  jest.mocked(ensurePhotoPermission).mockImplementation(() => new Promise(resolve => { allow = resolve; }));
  const view = mount(); let running!: Promise<void>;
  await act(async () => { running = hook.capture({ variant: 'wheel', destination: 'photos' }); });
  input.selectedIds.length = 0; input.theme = themeFor('dark');
  await act(async () => allow());
  expect(jest.mocked(renderChartExport).mock.calls[0][0].selectedIds).toEqual(['sun']);
  expect(jest.mocked(renderChartExport).mock.calls[0][0].theme.scheme).toBe('light');
  await ready(view); await act(async () => running);
  expect(saveChartToPhotos).toHaveBeenCalledWith('file:///tmp/chart.png'); expect(shareAsync).not.toHaveBeenCalled();
  expect(hook.notice).toBe('Saved to Photos');
  act(() => jest.advanceTimersByTime(4000)); expect(hook.notice).toBeUndefined();
  act(() => view.unmount());
});
test('permission denial offers Settings, never renders/captures, and recovers', async () => {
  jest.mocked(ensurePhotoPermission).mockRejectedValue(new PhotoPermissionError());
  const view = mount();
  await act(async () => hook.capture({ variant: 'wheel', destination: 'photos' }));
  expect(renderChartExport).not.toHaveBeenCalled(); expect(hook.capturing).toBe(false);
  expect(Alert.alert).toHaveBeenCalledWith('Photo access needed', expect.any(String), expect.arrayContaining([expect.objectContaining({ text: 'Open Settings' })]));
  act(() => view.unmount());
});
test('invalid output dimensions never reach a destination, release the image, and allow retry', async () => {
  jest.mocked(chartExportSize).mockReturnValue({ width: 390, height: 390 });
  const view = mount(); let running!: Promise<void>;
  await act(async () => { running = hook.capture({ variant: 'wheel', destination: 'share' }); });
  await ready(view); await act(async () => running);
  expect(shareAsync).not.toHaveBeenCalled(); expect(releaseChartExport).toHaveBeenCalledTimes(1);
  expect(Alert.alert).toHaveBeenCalledWith('Couldn’t share chart', expect.stringContaining('resolution'));
  expect(hook.capturing).toBe(false); act(() => view.unmount());
});
test('unmount while rendering cancels instead of opening sharing later', async () => {
  const view = mount(); let running!: Promise<void>;
  await act(async () => { running = hook.capture({ variant: 'wheel', destination: 'share' }); });
  act(() => view.unmount()); await running;
  expect(shareAsync).not.toHaveBeenCalled(); expect(Alert.alert).not.toHaveBeenCalled();
});
test('a Photos write already started completes after unmount and releases its temporary file', async () => {
  let finish!: () => void;
  jest.mocked(saveChartToPhotos).mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const view = mount(); let running!: Promise<void>;
  await act(async () => { running = hook.capture({ variant: 'wheel', destination: 'photos' }); });
  await ready(view); expect(saveChartToPhotos).toHaveBeenCalledTimes(1);
  act(() => view.unmount()); finish(); await running;
  expect(releaseChartExport).toHaveBeenCalledWith('file:///tmp/chart.png'); expect(Alert.alert).not.toHaveBeenCalled();
});
test('render failures clear the surface and never save or share', async () => {
  const view = mount(); let running!: Promise<void>;
  await act(async () => { running = hook.capture({ variant: 'wheel', destination: 'photos' }); });
  await act(async () => { failRender(new Error('Bad glyph')); await running; });
  expect(hook.capturing).toBe(false); expect(saveChartToPhotos).not.toHaveBeenCalled();
  expect(Alert.alert).toHaveBeenCalledWith('Couldn’t save chart', 'Bad glyph'); act(() => view.unmount());
});
