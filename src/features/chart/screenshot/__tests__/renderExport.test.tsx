import { drawAsPicture, Skia } from '@shopify/react-native-skia';
import { File } from 'expo-file-system';
import { renderChartExport, chartExportSize } from '../renderExport';
import { themeFor } from '@/theme';
import { buildConfiguration } from '../../config/buildConfiguration';
import { parsePreset } from '../../schema/preset';
import classic from '../../fixtures/presets/classic.json';
import fixture from '../../fixtures/engine/sibly-1776.json';
import type { ChartCalculationResponse } from '../../config/engine-types';

const mockWrite = jest.fn(), mockDelete = jest.fn();
jest.mock('expo-file-system', () => ({ Paths: { cache: 'file:///cache' }, File: jest.fn().mockImplementation((base, name) => ({
  uri: name ? `${base}/${name}` : base, exists: true, write: mockWrite, delete: mockDelete,
})) }));
const picture = { dispose: jest.fn() };
const image = { width: () => 2532, height: () => 2532, encodeToBytes: jest.fn(() => new Uint8Array([1,2,3])), dispose: jest.fn() };
const surface = { getCanvas: () => ({ drawPicture: jest.fn() }), flush: jest.fn(), makeImageSnapshot: () => image, dispose: jest.fn() };
const preset = parsePreset(classic);
const snapshot = { config: buildConfiguration(fixture as ChartCalculationResponse,preset), width: 390, selectedIds: [], selectionStyle: preset.selection, theme: themeFor('light'), cards: [] };
beforeEach(() => {
  jest.clearAllMocks(); mockWrite.mockReset();
  const sdk = jest.requireMock('@shopify/react-native-skia');
  jest.spyOn(sdk,'drawAsPicture').mockResolvedValue(picture as never);
  jest.spyOn(sdk,'loadData').mockImplementation(async () => ({ width: () => 20, height: () => 20 }) as never);
  image.encodeToBytes.mockReset().mockReturnValue(new Uint8Array([1,2,3]));
  jest.spyOn(Skia.Surface,'MakeOffscreen').mockReturnValue(surface as never);
});
afterEach(() => jest.restoreAllMocks());
test('offscreen allocation failure releases the recorded drawing and writes no file', async () => {
  jest.mocked(Skia.Surface.MakeOffscreen).mockReturnValue(null);
  await expect(renderChartExport(snapshot,'wheel',new AbortController().signal)).rejects.toThrow('graphics memory');
  expect(picture.dispose).toHaveBeenCalledTimes(1); expect(mockWrite).not.toHaveBeenCalled();
});
test('PNG encoder failure disposes the image, surface and picture', async () => {
  image.encodeToBytes.mockImplementation(() => { throw new Error('Encoder failed'); });
  await expect(renderChartExport(snapshot,'wheel',new AbortController().signal)).rejects.toThrow('Encoder failed');
  expect(image.dispose).toHaveBeenCalledTimes(1); expect(surface.dispose).toHaveBeenCalledTimes(1); expect(picture.dispose).toHaveBeenCalledTimes(1);
  expect(mockWrite).not.toHaveBeenCalled();
});
test('partial cache write deletes the file and disposes native graphics resources', async () => {
  mockWrite.mockImplementation(() => { throw new Error('Disk full'); });
  await expect(renderChartExport(snapshot,'wheel',new AbortController().signal)).rejects.toThrow('Disk full');
  expect(mockDelete).toHaveBeenCalledTimes(1); expect(image.dispose).toHaveBeenCalledTimes(1); expect(surface.dispose).toHaveBeenCalledTimes(1);
});
test('pre-cancelled exports allocate neither native graphics nor files', async () => {
  const controller = new AbortController(); controller.abort();
  await expect(renderChartExport(snapshot,'wheel',controller.signal)).rejects.toThrow('cancelled');
  expect(drawAsPicture).not.toHaveBeenCalled(); expect(File).not.toHaveBeenCalled();
});

test('reads encoded PNG dimensions and closes the file handle', () => {
  const bytes = new Uint8Array(24), data = new DataView(bytes.buffer);
  [0x89504e47,0x0d0a1a0a,13,0x49484452,2604,3408].forEach((value,index) => data.setUint32(index*4,value));
  const close = jest.fn();
  jest.mocked(File).mockImplementationOnce(() => ({ open: () => ({ readBytes: () => bytes, close }) }) as never);
  expect(chartExportSize('file:///chart.png')).toEqual({ width: 2604, height: 3408 });
  expect(close).toHaveBeenCalledTimes(1);
});
test('rejects an incomplete PNG and still closes the file handle', () => {
  const close = jest.fn();
  jest.mocked(File).mockImplementationOnce(() => ({ open: () => ({ readBytes: () => new Uint8Array(4), close }) }) as never);
  expect(() => chartExportSize('file:///chart.png')).toThrow('incomplete');
  expect(close).toHaveBeenCalledTimes(1);
});
