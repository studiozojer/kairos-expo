import { calculateChart as nativeCalculate } from '../../../../modules/kairos';
import type { ChartCalculationResponse } from '../config/engine-types';

// Fixed city reference, not the device's measured location. UTC drives calculations.
export const DEFAULT_LOCATION = {
  name: 'Seattle, WA', latitude: 47.6062, longitude: -122.3321,
  elevation: 0, timezone: 'America/Los_Angeles',
} as const;

// Calculate independently of display visibility: toggles only change rendering.
export const SKY_BODIES = [
  'Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn',
  'Uranus', 'Neptune', 'Pluto', 'MeanNode', 'MeanApogee', 'Chiron',
] as const;

export function chartRequest(datetime: string) {
  const time = Date.parse(datetime);
  // Deliberate first-slice coverage inside the bundled contemporary ephemeris.
  if (!Number.isFinite(time) || time < Date.UTC(1900, 0, 1) || time >= Date.UTC(2100, 0, 1)) {
    throw new Error('Chart time must be between 1900 and 2100.');
  }
  return {
    datetime: new Date(time).toISOString(),
    latitude: DEFAULT_LOCATION.latitude,
    longitude: DEFAULT_LOCATION.longitude,
    elevation: DEFAULT_LOCATION.elevation,
    chart_kind: 'Transit', house_system: 'Placidus', zodiac_system: 'Tropical',
    lunar_node_type: 'Mean', enabled_bodies: SKY_BODIES, enabled_stars: [],
  };
}

export async function calculateChart(datetime: string): Promise<ChartCalculationResponse> {
  const request = chartRequest(datetime);
  const chart: ChartCalculationResponse = JSON.parse(await nativeCalculate(JSON.stringify(request)));
  // Check the native boundary before feeding geometry; a cast is not validation.
  if (!chart?.celestial || !Array.isArray(chart.celestial.nodes) ||
      !Array.isArray(chart.celestial.edges) || !Array.isArray(chart.houses?.nodes) ||
      chart.houses.nodes.length !== 12 ||
      chart.chart_metadata?.chart_type !== 'Transit' ||
      Date.parse(chart.chart_metadata.datetime) !== Date.parse(request.datetime) ||
      chart.chart_metadata.coordinates?.latitude !== request.latitude ||
      chart.chart_metadata.coordinates?.longitude !== request.longitude) {
    throw new Error('Invalid chart response from the native engine.');
  }
  const ids = new Set(chart.celestial.nodes.map(n => n.id));
  if (!SKY_BODIES.every(body => chart.celestial.nodes.some(n => n.body === body)) ||
      !chart.celestial.nodes.every(n => typeof n.id === 'string' &&
        Number.isFinite(n.position?.longitude) && Number.isFinite(n.position?.speed_longitude)) ||
      !chart.houses.nodes.every(n => Number.isFinite(n.cusp_longitude)) ||
      !chart.celestial.edges.every(e => ids.has(e.from) && ids.has(e.to) && Number.isFinite(e.orb))) {
    throw new Error('Incomplete chart response from the native engine.');
  }
  return chart;
}
