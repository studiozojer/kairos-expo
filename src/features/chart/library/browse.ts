import type { SavedChart } from '../active/model';
import type { LibraryPreferences } from './preferences';

/** Tags are ORed; text search is intersected with the tag selection. */
export function browseCharts(charts: SavedChart[], query: string, tagIds: string[], preferences: LibraryPreferences): SavedChart[] {
  const text = query.trim().toLocaleLowerCase();
  const selected = new Set(tagIds);
  return charts.filter(chart => (!text || `${chart.name}\n${chart.settings.location.name}`.toLocaleLowerCase().includes(text)) &&
    (!selected.size || chart.metadata?.tags.some(tag => selected.has(tag.id))))
    .sort((a, b) => {
      const favorite = Number(!!b.metadata?.favorite) - Number(!!a.metadata?.favorite);
      if (favorite) return favorite;
      let order = 0;
      switch (preferences.sort) {
        case 'name-asc': order = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }); break;
        case 'name-desc': order = b.name.localeCompare(a.name, undefined, { sensitivity: 'base' }); break;
        case 'date-asc': order = Date.parse(a.datetime) - Date.parse(b.datetime); break;
        case 'date-desc': order = Date.parse(b.datetime) - Date.parse(a.datetime); break;
        default: order = (preferences.opened[b.id] ?? 0) - (preferences.opened[a.id] ?? 0);
      }
      return order || a.id.localeCompare(b.id);
    });
}

/** Independent offline creations can share a label; one chip matches all their IDs. */
export function libraryTags(charts: SavedChart[]) {
  const groups = new Map<string, { id: string; name: string; ids: string[] }>();
  for (const chart of charts) for (const tag of chart.metadata?.tags ?? []) {
    const key = tag.name.trim().toLowerCase();
    const group = groups.get(key);
    if (group) { if (!group.ids.includes(tag.id)) group.ids.push(tag.id); }
    else groups.set(key, { id: key, name: tag.name, ids: [tag.id] });
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

export function rowDate(datetime: string, timezone: string) {
  const date = new Date(datetime);
  const format = new Intl.DateTimeFormat('en-US', { timeZone: timezone, month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZoneName: 'shortOffset' });
  const p = Object.fromEntries(format.formatToParts(date).map(part => [part.type, part.value]));
  return { date: `${p.month}/${p.day}/${p.year}`, time: `${p.hour}:${p.minute}`, offset: p.timeZoneName.replace('GMT', 'UTC') };
}
