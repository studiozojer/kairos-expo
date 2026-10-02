import { validateDraft, type SavedChart } from '../active/model';
import type { ArchivedChart } from './types';
/** Only a separately validated ordinary-library destination can enter calculation. */
export function archiveDestination(record: ArchivedChart, saved: SavedChart[]): string | null {
  if (record.tombstone || record.compatibility.state !== 'ready' || !record.destinationChartId) return null;
  const destination = saved.find(chart => chart.id === record.destinationChartId);
  if (!destination) return null;
  try { validateDraft(destination); return destination.id; } catch { return null; }
}
