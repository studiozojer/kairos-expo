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

// Cross the request → real engine fixture → display preset → glyph seams.
import { SKY_ASTEROIDS } from '../skyBodies';
import { buildConfiguration } from '../../config/buildConfiguration';
import { bundledPreset } from '../../display/presets';
import { toggleBody } from '../../display/displayPreset';
import { GLYPH_ASSETS } from '../../render/glyph-map.gen';

test.each(SKY_ASTEROIDS)('%s is requested and can be displayed with a bundled glyph', body => {
  expect(chartRequest(datetime).enabled_bodies).toContain(body);
  const preset = toggleBody(bundledPreset('classic')!.preset, body, true);
  const config = buildConfiguration(fixture, preset);
  const placements = config.rings.flatMap(ring => ring.type.kind === 'planets' ? ring.type.placements : []);
  const placement = placements.find(p => p.bodyName === body);
  expect(placement).toBeDefined();
  expect(GLYPH_ASSETS).toHaveProperty(`celestials/${placement!.glyphAsset}`);
  const hidden = buildConfiguration(fixture, toggleBody(preset, body, false));
  expect(hidden.rings.flatMap(ring => ring.type.kind === 'planets' ? ring.type.placements : [])
    .some(p => p.bodyName === body)).toBe(false);
});

test.each(SKY_ASTEROIDS)('rejects native output silently omitting %s', async body => {
  native.mockResolvedValue(JSON.stringify({ ...fixture, celestial: { ...fixture.celestial,
    nodes: fixture.celestial.nodes.filter(n => n.body !== body),
  } }));
  await expect(calculateChart(datetime)).rejects.toThrow('Incomplete chart');
});
