import { browseCharts, libraryTags, rowDate } from '../browse';
import { DEFAULT_SETTINGS } from '../../settings/chartSettings';
import type { SavedChart } from '../../active/model';
const chart = (id: string, name: string, tags: string[] = [], favorite = false): SavedChart => ({ id, name, datetime: '1990-07-05T21:30:00.000Z', settings: DEFAULT_SETTINGS, metadata: { favorite, tags: tags.map(id => ({ id, name: id })) } });
const preferences = { sort: 'recent' as const, opened: { c: 30, a: 10, b: 20 } };
const ids = (charts: SavedChart[]) => charts.map(chart => chart.id);

test('OR tags intersect name/location search, including case and whitespace', () => {
  const charts = [chart('a', 'Alice', ['family']), chart('b', 'ALICE', ['work']), chart('c', 'Bob', ['family']), chart('d', 'Alice')];
  expect(ids(browseCharts(charts, ' alice ', ['family', 'work'], preferences))).toEqual(['b', 'a']);
  expect(ids(browseCharts(charts, DEFAULT_SETTINGS.location.name, ['family'], preferences))).toEqual(['c', 'a']);
  expect(browseCharts(charts, 'unmatched', [], preferences)).toEqual([]);
});
test('favorites always precede recency/name/date and ties have deterministic identities', () => {
  const charts = [chart('c', 'Zoe'), chart('b', 'Anna'), chart('a', 'Anna'), chart('f', 'Favorite', [], true)];
  expect(ids(browseCharts(charts, '', [], preferences))).toEqual(['f', 'c', 'b', 'a']);
  expect(ids(browseCharts(charts, '', [], { ...preferences, sort: 'name-asc' }))).toEqual(['f', 'a', 'b', 'c']);
  expect(ids(browseCharts(charts, '', [], { ...preferences, sort: 'name-desc' }))).toEqual(['f', 'c', 'a', 'b']);
  charts[0].datetime = '2001-01-01T00:00:00Z';
  expect(ids(browseCharts(charts, '', [], { ...preferences, sort: 'date-desc' }))).toEqual(['f', 'c', 'a', 'b']);
  expect(ids(browseCharts(charts, '', [], { ...preferences, sort: 'date-asc' }))).toEqual(['f', 'a', 'b', 'c']);
});
test('legacy charts without metadata remain visible, catalog follows edits and deletions', () => {
  const old = chart('old', 'Old'); delete old.metadata;
  expect(ids(browseCharts([old], '', [], preferences))).toEqual(['old']);
  expect(libraryTags([old, chart('a', 'A', ['family']), chart('b', 'B', ['family'])])).toEqual([{ id: 'family', name: 'family', ids: ['family'] }]);
  expect(libraryTags([old])).toEqual([]);
});
test('rows format in chart timezone with DST and fractional offsets', () => {
  expect(rowDate('2026-07-01T00:15:00Z', 'America/Los_Angeles')).toEqual({ date: '06/30/2026', time: '17:15', offset: 'UTC−7' });
  expect(rowDate('2026-01-01T00:15:00Z', 'America/Los_Angeles').offset).toBe('UTC−8');
  expect(rowDate('2026-01-01T00:15:00Z', 'Asia/Kathmandu').offset).toBe('UTC+5:45');
  expect(rowDate('2026-01-01T00:15:00Z', 'America/St_Johns').offset).toBe('UTC−3:30');
});

test('independently created tags with the same name form one filter matching both identities', () => {
  const a = chart('a', 'Alice'), b = chart('b', 'Bob');
  a.metadata!.tags = [{ id: 'device-a', name: 'Family' }];
  b.metadata!.tags = [{ id: 'device-b', name: 'family' }];
  const groups = libraryTags([a, b]);
  expect(groups).toHaveLength(1);
  expect(groups[0].ids).toEqual(['device-a', 'device-b']);
  expect(ids(browseCharts([a, b], '', groups[0].ids, preferences))).toEqual(['b', 'a']);
});

test('does not depend on native shortOffset or en-US 24-hour formatting support', () => {
  const Original = Intl.DateTimeFormat;
  const format = jest.spyOn(Intl, 'DateTimeFormat').mockImplementation((locale, options) => {
    // Reproduce the iOS runtime observed in EAS: en-US stayed 12-hour and GMT lost its offset.
    if (locale === 'en-US' && options?.timeZoneName === 'shortOffset') {
      const broken = new Original(locale, { ...options, hourCycle: undefined, hour12: true });
      const parts = broken.formatToParts.bind(broken);
      broken.formatToParts = value => parts(value).map(part => part.type === 'timeZoneName' ? { ...part, value: 'GMT' } : part);
      return broken;
    }
    return new Original(locale, options);
  });
  try { expect(rowDate('2026-10-01T02:13:11Z', 'America/Los_Angeles')).toEqual({ date: '09/30/2026', time: '19:13', offset: 'UTC−7' }); }
  finally { format.mockRestore(); }
});
