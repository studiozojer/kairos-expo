import { themeFor } from '@/theme';
import { exportCards, exportLayout, snapshotExport, type ChartExportSnapshot } from '../model';
import { buildConfiguration } from '../../config/buildConfiguration';
import { parsePreset } from '../../schema/preset';
import classic from '../../fixtures/presets/classic.json';
import fixture from '../../fixtures/engine/sibly-1776.json';
import type { ChartCalculationResponse } from '../../config/engine-types';
import { nowInstance } from '../../active/model';

export function snapshot(): ChartExportSnapshot {
  const preset = parsePreset(classic);
  return { width: 390, config: buildConfiguration(fixture as ChartCalculationResponse, preset), theme: themeFor('light'),
    selectionStyle: preset.selection, selectedIds: ['sun'], cards: [{ id: 'first', name: 'Synthetic chart', date: 'Jul 4, 1776', time: '5:10 PM', location: 'Philadelphia' }] };
}

test.each([320, 390, 768])('export pixel dimensions follow the viewport width %i', width => {
  const value = { ...snapshot(), width };
  const wheel = exportLayout(value, 'wheel');
  const full = exportLayout(value, 'full');
  expect(wheel.pixelWidth).toBe((width + 32) * 6);
  expect(wheel.pixelHeight).toBe(wheel.pixelWidth);
  expect(wheel.width * wheel.scale).toBe(wheel.pixelWidth);
  expect(full.pixelHeight).toBeGreaterThan(full.pixelWidth);
  expect(full.height * full.scale).toBe(full.pixelHeight);
});
test('snapshot isolates ordered cards, render configuration, selection and appearance', () => {
  const input = snapshot(), copy = snapshotExport(input);
  input.cards[0].name = 'Changed'; input.selectedIds.length = 0;
  input.config.rings.length = 0; input.theme.color.bgSolidBase = '#abcdef';
  expect(copy.cards[0].name).toBe('Synthetic chart');
  expect(copy.selectedIds).toEqual(['sun']); expect(copy.config.rings.length).toBeGreaterThan(0);
  expect(copy.theme.color.bgSolidBase).not.toBe('#abcdef');
});
test('cards describe the displayed result instead of the pending requested time/location', () => {
  const chart = nowInstance();
  chart.settings.location = { ...chart.settings.location, name: 'Pending location' };
  const displayedSettings = { ...chart.settings, location: { ...chart.settings.location, name: 'Displayed location', timezone: 'UTC' } };
  const cards = exportCards([chart], { [chart.id]: { status: 'loading', retry: jest.fn(), result: {
    datetime: '2000-01-02T03:04:00Z', settings: displayedSettings, attempt: 0, starKey: '[]', chart: fixture as ChartCalculationResponse,
  } } });
  expect(cards[0]).toMatchObject({ id: chart.id, location: 'Displayed location' });
  expect(cards[0].date).toContain('2000'); expect(cards[0].time).toContain('3:04');
  expect(() => exportCards([chart], {})).toThrow('finish loading');
});
