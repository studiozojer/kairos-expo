import { searchLocations } from '../../../../modules/kairos';
import { isLocation, type ChartLocation } from './chartSettings';

export async function searchAtlas(query: string): Promise<ChartLocation[]> {
  const raw: unknown = JSON.parse(await searchLocations(query.trim()));
  if (!Array.isArray(raw)) throw new Error('Invalid atlas response');
  return raw.map(value => {
    const location = {
      name: [value.name, value.region, value.country].filter(Boolean).join(', '),
      latitude: value.coordinates?.latitude, longitude: value.coordinates?.longitude,
      elevation: value.coordinates?.elevation ?? 0, timezone: value.timezone,
    };
    if (!isLocation(location)) throw new Error('Invalid atlas location');
    return location;
  });
}
