import { useEffect, useMemo, useState } from 'react';
import { searchQuery, searchSources, type SearchProvider, type SearchSection } from './search';

export function useGlobalSearch(raw: string, providers: readonly SearchProvider[]) {
  const query = useMemo(() => searchQuery(raw), [raw]);
  const [attempt, setAttempt] = useState(0);
  const [response, setResponse] = useState<{ query: typeof query; providers: typeof providers; attempt: number; sections: SearchSection[] } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void searchSources(query, providers, controller.signal).then(sections => {
      // Providers may ignore cancellation. Never publish an obsolete query or account.
      if (!controller.signal.aborted) setResponse({ query, providers, attempt, sections });
    });
    return () => controller.abort();
  }, [query, providers, attempt]);
  const current = response?.query === query && response.providers === providers && response.attempt === attempt;
  return { query, loading: !current, sections: current ? response.sections : [], retry: () => setAttempt(value => value + 1) };
}
