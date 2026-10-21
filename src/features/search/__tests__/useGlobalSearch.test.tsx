import { useLayoutEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useGlobalSearch } from '../useGlobalSearch';
import type { SearchProvider, SearchResult } from '../search';
let value: ReturnType<typeof useGlobalSearch>;
function Probe({ query, providers }: { query: string; providers: SearchProvider[] }) { const state = useGlobalSearch(query, providers); useLayoutEffect(() => { value = state; }); return null; }
const result = (title: string): SearchResult[] => [{ id: title, title, subtitle: '', action: { type: 'open-saved-chart', chartId: title } }];
test('late responses cannot replace a newer query; changing account sources hides old results immediately', async () => {
  const pending: { resolve: (r: SearchResult[]) => void; signal: AbortSignal }[] = [];
  const providers: SearchProvider[] = [{ id: 'charts', title: 'Charts', search: (_q, signal) => new Promise(resolve => pending.push({ resolve, signal })) }];
  let view!: ReactTestRenderer;
  act(() => { view = create(<Probe query="old" providers={providers} />); });
  act(() => view.update(<Probe query="new" providers={providers} />));
  expect(pending[0].signal.aborted).toBe(true);
  await act(async () => pending[1].resolve(result('new')));
  await act(async () => pending[0].resolve(result('old')));
  expect(value.sections[0].results[0].title).toBe('new');
  const nextProviders = [...providers];
  act(() => view.update(<Probe query="new" providers={nextProviders} />));
  expect(value.sections).toEqual([]);
  expect(value.loading).toBe(true);
  await act(async () => pending[2].resolve(result('other account')));
  expect(value.sections[0].results[0].title).toBe('other account');
  act(() => view.unmount());
  expect(pending[2].signal.aborted).toBe(true);
});
