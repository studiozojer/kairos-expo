export interface ChartTag { id: string; name: string }
export interface ChartMetadata { tags: ChartTag[]; favorite: boolean }
/** Undefined means legacy omission; null and malformed values must not erase data. */
export function normalizeMetadata(value: unknown): ChartMetadata | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object') throw new Error('Invalid chart metadata');
  const metadata = value as ChartMetadata;
  if (typeof metadata.favorite !== 'boolean' || !Array.isArray(metadata.tags) || metadata.tags.length > 32) throw new Error('Invalid chart metadata');
  const ids = new Set<string>(), names = new Set<string>();
  const tags = metadata.tags.map(tag => {
    if (!tag || typeof tag.id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(tag.id) || typeof tag.name !== 'string') throw new Error('Invalid chart tag');
    const name = tag.name.trim();
    if (!name || [...name].length > 60 || ids.has(tag.id) || names.has(name.toLowerCase())) throw new Error('Invalid or duplicate chart tag');
    ids.add(tag.id); names.add(name.toLowerCase());
    return { id: tag.id, name };
  });
  return { tags, favorite: metadata.favorite };
}
export function sameMetadata(left: unknown, right: unknown): boolean {
  const normalized = (value: unknown) => {
    const metadata = normalizeMetadata(value) ?? { favorite: false, tags: [] };
    return { ...metadata, tags: [...metadata.tags].sort((a, b) => a.id.localeCompare(b.id)) };
  };
  return JSON.stringify(normalized(left)) === JSON.stringify(normalized(right));
}
