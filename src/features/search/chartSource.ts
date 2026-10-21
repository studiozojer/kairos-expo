import type { SavedChart } from '../chart/active/model';
import { rowDate } from '../chart/library/browse';
import { normalizeSearchText, type SearchProvider } from './search';

/** Index only the current account's local library. No second persistence layer. */
export function chartSearchProvider(charts: readonly SavedChart[], opened: Record<string, number>): SearchProvider {
  const documents = charts.map(chart => {
    const date = rowDate(chart.datetime, chart.settings.location.timezone);
    const subtitle = `${chart.settings.location.name} · ${date.date} · ${date.time} ${date.offset}`;
    return { chart, subtitle, name: normalizeSearchText(chart.name),
      fields: [chart.name, chart.settings.location.name, ...(chart.metadata?.tags.map(tag => tag.name) ?? [])].map(normalizeSearchText) };
  });
  return { id: 'charts', title: 'Saved charts', search: query => documents
    .filter(doc => query.terms.every(term => doc.fields.some(field => field.includes(term))))
    .map(doc => ({ ...doc, rank: !query.text ? 0 : doc.name === query.text ? 3 : doc.name.startsWith(query.text) ? 2 : doc.name.includes(query.text) ? 1 : 0 }))
    .sort((a, b) => b.rank - a.rank || Number(!!b.chart.metadata?.favorite) - Number(!!a.chart.metadata?.favorite) ||
      (opened[b.chart.id] ?? 0) - (opened[a.chart.id] ?? 0) || a.name.localeCompare(b.name) || a.chart.id.localeCompare(b.chart.id))
    .map(({ chart, subtitle }) => ({ id: `chart:${chart.id}`, title: chart.name, subtitle, action: { type: 'open-saved-chart', chartId: chart.id } })) };
}
