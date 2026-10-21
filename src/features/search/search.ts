/** Preserve original input for future date/place interpreters. */
export interface SearchQuery { raw: string; text: string; terms: string[] }
export function normalizeSearchText(text: string) {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim().replace(/\s+/g, ' ');
}
export function searchQuery(raw: string): SearchQuery {
  const text = normalizeSearchText(raw);
  return { raw, text, terms: text ? text.split(' ') : [] };
}
// Extend this union when a destination exists. A future create-chart action can
// carry a draft rather than require a stored record ID.
export type SearchAction = { type: 'open-saved-chart'; chartId: string };
export interface SearchResult { id: string; title: string; subtitle: string; action: SearchAction }
export interface SearchProvider {
  id: string; title: string;
  search: (query: SearchQuery, signal: AbortSignal) => SearchResult[] | Promise<SearchResult[]>;
}
export interface SearchSection { id: string; title: string; results: SearchResult[]; failed: boolean }
/** Rankings belong to each source; unrelated scores are never compared. */
export async function searchSources(query: SearchQuery, providers: readonly SearchProvider[], signal: AbortSignal): Promise<SearchSection[]> {
  return Promise.all(providers.map(async provider => {
    try {
      return { id: provider.id, title: provider.title, results: await provider.search(query, signal), failed: false };
    } catch {
      return { id: provider.id, title: provider.title, results: [], failed: true };
    }
  }));
}
