import { getAllStarPositions } from '../../../../modules/kairos';
import { starId } from './library';
export interface CatalogStar {
  id: string; name: string; designation: string; displayDesignation: string; constellation: string;
  magnitude: number; longitude: number; sign: string; degrees: number; minutes: number;
}
export const CATALOG_REFERENCE = '2000-01-01T12:00:00.000Z';
/** Fixed tropical reference makes catalog ordering independent of open charts and presets. */
export function parseCatalog(raw: string): CatalogStar[] {
  const value = JSON.parse(raw);
  if (!Array.isArray(value)) throw new Error('Invalid star catalog');
  const ids = new Set<string>();
  return value.map(star => {
    if (!star || !['name','designation','display_designation','constellation','sign'].every(key => typeof star[key] === 'string') || !star.name.trim() ||
        !Number.isFinite(star.magnitude) || !Number.isFinite(star.longitude) || star.longitude < 0 || star.longitude >= 360 ||
        !Number.isInteger(star.degrees) || star.degrees < 0 || star.degrees > 29 || !Number.isInteger(star.minutes) || star.minutes < 0 || star.minutes > 59) throw new Error('Invalid star catalog entry');
    const id = starId(star.name);
    if (ids.has(id)) throw new Error('Duplicate star identity');
    ids.add(id);
    return { id, name: star.name, designation: star.designation, displayDesignation: star.display_designation, constellation: star.constellation,
      magnitude: star.magnitude, longitude: star.longitude, sign: star.sign, degrees: star.degrees, minutes: star.minutes };
  });
}
let loaded: CatalogStar[] | undefined;
let loading: Promise<CatalogStar[]> | undefined;
export function loadStarCatalog(): Promise<CatalogStar[]> {
  if (loaded) return Promise.resolve(loaded);
  if (loading) return loading;
  loading = Promise.resolve().then(() => getAllStarPositions(JSON.stringify({ datetime: CATALOG_REFERENCE, zodiac_system: 'Tropical' })))
    .then(raw => { const stars = parseCatalog(raw); if (!stars.length) throw new Error('The star catalog is empty.'); loaded = stars; return stars; })
    .finally(() => { loading = undefined; });
  return loading;
}
export function filterCatalog(stars: CatalogStar[], query: string, order: 'name' | 'position' | 'magnitude') {
  const text = query.trim().toLowerCase();
  return stars.filter(star => [star.name,star.designation,star.displayDesignation,star.constellation].some(value => value.toLowerCase().includes(text)))
    .sort((a,b) => (order === 'position' ? a.longitude - b.longitude : order === 'magnitude' ? a.magnitude - b.magnitude : 0) || a.name.localeCompare(b.name));
}
export const referencePosition = (star: CatalogStar) => `${star.degrees}° ${String(star.minutes).padStart(2,'0')}′ ${star.sign}`;
