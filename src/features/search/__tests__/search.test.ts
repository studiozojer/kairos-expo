import { chartSearchProvider } from '../chartSource';
import { searchQuery, searchSources, type SearchProvider } from '../search';
import { DEFAULT_SETTINGS } from '../../chart/settings/chartSettings';
import type { SavedChart } from '../../chart/active/model';
const signal = new AbortController().signal;
const chart = (id: string, name: string, favorite = false): SavedChart => ({ id, name, datetime: '2000-06-11T01:00:00Z',
  settings: { ...DEFAULT_SETTINGS, location: { ...DEFAULT_SETTINGS.location, name: 'Montréal', timezone: 'America/Los_Angeles' } },
  metadata: { favorite, tags: [{ id: 'family', name: 'Family' }] } });

test('preserves original input for future interpretation; whitespace is browse', () => {
  expect(searchQuery(' June 10, 2000 ')).toEqual({ raw: ' June 10, 2000 ', text: 'june 10, 2000', terms: ['june', '10,', '2000'] });
  expect(searchQuery(' \n ').terms).toEqual([]);
});
test('matches accents, case, and terms across fields without mutating source order', async () => {
  const charts = [chart('b', 'Bob'), chart('a', 'Álice')];
  const provider = chartSearchProvider(charts, {});
  expect((await provider.search(searchQuery(' ALICE montreal family '), signal)).map(r => r.id)).toEqual(['chart:a']);
  expect(await provider.search(searchQuery('Alice missing'), signal)).toEqual([]);
  expect(charts.map(c => c.id)).toEqual(['b', 'a']);
});
test('exact names outrank prefixes and favorites; empty query browses favorite then recent', async () => {
  const provider = chartSearchProvider([chart('b', 'Alice extended', true), chart('a', 'Alice'), chart('c', 'Carol')], { c: 5 });
  expect((await provider.search(searchQuery('Alice'), signal)).map(r => r.id)).toEqual(['chart:a', 'chart:b']);
  expect((await provider.search(searchQuery(''), signal)).map(r => r.id)).toEqual(['chart:b', 'chart:c', 'chart:a']);
});
test('subtitle uses chart-local date and action retains record identity', async () => {
  const [result] = await chartSearchProvider([chart('a', 'Alice')], {}).search(searchQuery('Alice'), signal);
  expect(result.subtitle).toContain('06/10/2000');
  expect(result.action).toEqual({ type: 'open-saved-chart', chartId: 'a' });
});
test('one broken source does not erase another source or masquerade as no matches', async () => {
  const broken: SearchProvider = { id: 'broken', title: 'Broken', search: () => { throw Error('offline'); } };
  const sections = await searchSources(searchQuery('Alice'), [broken, chartSearchProvider([chart('a', 'Alice')], {})], signal);
  expect(sections[0]).toMatchObject({ failed: true, results: [] });
  expect(sections[1].results).toHaveLength(1);
});
