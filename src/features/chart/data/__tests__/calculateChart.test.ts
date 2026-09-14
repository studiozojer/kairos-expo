import fixture from '../../fixtures/engine/seattle-2026.json';
import { calculateChart, chartRequest, DEFAULT_LOCATION } from '../calculateChart';
import { calculateChart as nativeCalculate } from '../../../../../modules/kairos';

jest.mock('../../../../../modules/kairos', () => ({ calculateChart: jest.fn() }));
const native = jest.mocked(nativeCalculate);
const datetime = '2026-09-13T19:00:00.000Z';

beforeEach(() => native.mockReset());

test('sends Seattle, a UTC instant, and transit semantics to the native engine', async () => {
  native.mockResolvedValue(JSON.stringify(fixture));
  const chart = await calculateChart(datetime);
  expect(JSON.parse(native.mock.calls[0][0])).toMatchObject({
    datetime, latitude: DEFAULT_LOCATION.latitude, longitude: DEFAULT_LOCATION.longitude,
    chart_kind: 'Transit', house_system: 'Placidus', zodiac_system: 'Tropical',
  });
  expect(chart.houses.nodes).toHaveLength(12);
  expect(chart.celestial.nodes.some(n => n.body === 'Ascendant')).toBe(true);
});

test('rejects stale or mismatched engine output rather than showing it as now', async () => {
  native.mockResolvedValue(JSON.stringify(fixture));
  await expect(calculateChart('2026-09-14T19:00:00Z')).rejects.toThrow('Invalid chart');
  native.mockResolvedValue(JSON.stringify({ ...fixture, chart_metadata: { ...fixture.chart_metadata, chart_type: 'Natal' } }));
  await expect(calculateChart(datetime)).rejects.toThrow('Invalid chart');
});

test('rejects missing bodies and malformed native JSON', async () => {
  native.mockResolvedValue(JSON.stringify({ ...fixture, celestial: { ...fixture.celestial, nodes: [] } }));
  await expect(calculateChart(datetime)).rejects.toThrow('Incomplete chart');
  native.mockResolvedValue('not json');
  await expect(calculateChart(datetime)).rejects.toThrow();
});

test('propagates native errors and rejects dates outside bundled scope', async () => {
  native.mockRejectedValue(new Error('missing ephemeris'));
  await expect(calculateChart(datetime)).rejects.toThrow('missing ephemeris');
  expect(() => chartRequest('invalid')).toThrow();
  expect(() => chartRequest('2100-01-01T00:00:00Z')).toThrow();
});
