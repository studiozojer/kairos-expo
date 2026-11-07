import { loadAccountCharts } from '../account';
import { DEFAULT_SETTINGS } from '../../features/chart/settings/chartSettings';

const chart = { name: 'Fixture', datetime: '2000-06-11T06:35:00.000Z', settings: DEFAULT_SETTINGS };
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });

it('applies account updates and tombstones across feed pages without writing', async () => {
  const responses = [
    { records: [{ id: 'removed', revision: 1, chart }, { id: 'kept', revision: 2, chart }], cursor: 2, hasMore: true },
    { records: [{ id: 'removed', revision: 3, chart: null }], cursor: 3, hasMore: false },
    { records: [], cursor: 0, hasMore: false },
  ];
  const fetcher = jest.fn(async () => ({ ok: true, status: 200, json: async () => responses.shift() } as Response));
  global.fetch = fetcher;
  const result = await loadAccountCharts(new AbortController().signal, () => {});
  expect(result.charts).toEqual([{ ...chart, id: 'kept' }]);
  expect(fetcher.mock.calls.map(call => (call as unknown as [string])[0])).toEqual([
    '/local/changes?cursor=0', '/local/changes?cursor=2', '/local/transfers?cursor=0',
  ]);
});

it('rejects a feed that would skip chart revisions', async () => {
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({
    records: [{ id: 'fixture', revision: 1, chart }], cursor: 2, hasMore: false,
  }) } as Response));
  await expect(loadAccountCharts(new AbortController().signal, () => {})).rejects.toThrow('Invalid account chart cursor');
});

it('rejects malformed chart data before it can reach the renderer', async () => {
  global.fetch = jest.fn(async () => ({ ok: true, json: async () => ({
    records: [{ id: 'fixture', revision: 1, chart: { ...chart, datetime: 'not-a-date' } }], cursor: 1, hasMore: false,
  }) } as Response));
  await expect(loadAccountCharts(new AbortController().signal, () => {})).rejects.toThrow('Invalid chart');
});
