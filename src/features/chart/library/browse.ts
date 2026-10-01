import type { SavedChart } from '../active/model';
import { localFields } from '../active/wallTime';
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
  const instant = Date.parse(datetime);
  // Hermes/iOS does not reliably honor en-US hourCycle or shortOffset together.
  // Use the same explicit civil-time parts as the editor, then derive the offset.
  const wall = localFields(instant, timezone);
  const [year, month, day] = wall.date.split('-');
  const seconds = (Date.parse(`${wall.date}T${wall.clock}Z`) - Math.floor(instant / 1000) * 1000) / 1000;
  const absolute = Math.abs(seconds);
  const hours = Math.floor(absolute / 3600);
  const minutes = Math.floor(absolute % 3600 / 60);
  const remainder = absolute % 60;
  const offset = seconds === 0 ? 'UTC' : `UTC${seconds < 0 ? '−' : '+'}${hours}${minutes || remainder ? `:${String(minutes).padStart(2, '0')}` : ''}${remainder ? `:${String(remainder).padStart(2, '0')}` : ''}`;
  return { date: `${month}/${day}/${year}`, time: wall.clock.slice(0, 5), offset };
}
