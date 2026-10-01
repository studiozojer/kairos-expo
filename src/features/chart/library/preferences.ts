export const LIBRARY_SORTS = ['recent', 'name-asc', 'name-desc', 'date-desc', 'date-asc'] as const;
export type LibrarySort = typeof LIBRARY_SORTS[number];
export interface LibraryPreferences { sort: LibrarySort; opened: Record<string, number> }
export const DEFAULT_LIBRARY_PREFERENCES: LibraryPreferences = { sort: 'recent', opened: {} };
export function parseLibraryPreferences(raw: string | undefined): LibraryPreferences {
  if (!raw) return { sort: 'recent', opened: {} };
  const value = JSON.parse(raw) as LibraryPreferences;
  if (!value || !LIBRARY_SORTS.includes(value.sort) || !value.opened || typeof value.opened !== 'object' || Array.isArray(value.opened) || Object.values(value.opened).some(time => !Number.isFinite(time) || time < 0)) throw new Error('Invalid library preferences');
  return value;
}
