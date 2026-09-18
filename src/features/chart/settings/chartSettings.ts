import type { HouseSystemName } from '../schema/ring-content';

export interface ChartLocation {
  name: string;
  latitude: number;
  longitude: number;
  elevation: number;
  timezone: string;
}
export interface ChartSettings { location: ChartLocation; houseSystem: HouseSystemName }
export const DEFAULT_LOCATION: ChartLocation = {
  name: 'Seattle, WA', latitude: 47.6062, longitude: -122.3321,
  elevation: 0, timezone: 'America/Los_Angeles',
};
export const DEFAULT_SETTINGS: ChartSettings = { location: DEFAULT_LOCATION, houseSystem: 'Placidus' };
export const SETTINGS_KEY = 'kairos.chart.defaults.v1';
export const HOUSE_SYSTEMS: readonly HouseSystemName[] = [
  'Whole Sign', 'Placidus', 'Equal', 'Koch', 'Porphyrius', 'Regiomontanus',
  'Campanus', 'Meridian', 'Morinus', 'Alcabitus', 'Topocentric', 'Vehlow', 'Equal (MC)',
];
export function isLocation(value: unknown): value is ChartLocation {
  if (!value || typeof value !== 'object') return false;
  const v = value as ChartLocation;
  if (typeof v.name !== 'string' || !v.name.trim() ||
    !Number.isFinite(v.latitude) || Math.abs(v.latitude) > 90 ||
    !Number.isFinite(v.longitude) || Math.abs(v.longitude) > 180 ||
    !Number.isFinite(v.elevation) || typeof v.timezone !== 'string' || !v.timezone) return false;
  try { new Intl.DateTimeFormat('en', { timeZone: v.timezone }); return true; } catch { return false; }
}
export function parseSettings(raw: string | null): ChartSettings {
  try {
    const value = JSON.parse(raw ?? 'null');
    return {
      location: isLocation(value?.location) ? value.location : DEFAULT_LOCATION,
      houseSystem: HOUSE_SYSTEMS.includes(value?.houseSystem) ? value.houseSystem : 'Placidus',
    };
  } catch { return DEFAULT_SETTINGS; }
}
