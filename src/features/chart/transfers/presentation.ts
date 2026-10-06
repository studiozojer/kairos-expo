import type { ConversionPreview } from './conversion';
import type { ArchivedChart } from './types';
import { calculationSettings } from '../settings/chartSettings';

export function currentPreview(record: ArchivedChart, previews: ConversionPreview[]) {
  return previews.find(p => p.transferId === record.transferId && p.snapshotId === record.snapshotId);
}
export function transferStatus(record: ArchivedChart, preview?: ConversionPreview): string {
  if (preview) return {
    compatible: 'Ready to add', needs_review: 'Needs confirmation', unsupported: 'Cannot be added yet',
    already_added: 'Added to Saved Charts', source_changed: 'Original changed · saved copy unchanged', deleted: 'Saved copy deleted',
  }[preview.state];
  if (record.compatibility.state === 'ready' && record.destinationChartId) return 'Added to Saved Charts';
  if (record.compatibility.reasons.includes('source_changed')) return 'Original changed · saved copy unchanged';
  if (record.compatibility.reasons.includes('destination_deleted')) return 'Saved copy deleted';
  return 'Not checked';
}
export function transferReasons(record: ArchivedChart, preview?: ConversionPreview): string[] {
  if (preview?.state === 'source_changed') return ['source_changed'];
  if (preview?.state === 'deleted') return ['destination_deleted'];
  if (transferStatus(record, preview) === 'Added to Saved Charts' || preview?.state === 'compatible') return [];
  return preview?.reasons ?? record.compatibility.reasons;
}
export function reviewGroups(selection: ConversionPreview[]) {
  const reasons = new Map<string, ConversionPreview[]>(), settings = new Map<string, ConversionPreview[]>();
  for (const p of selection) {
    for (const reason of new Set(p.reasons)) reasons.set(reason, [...(reasons.get(reason) ?? []), p]);
    if (p.chart) {
      const c = calculationSettings(p.chart.settings);
      const label = `${c.zodiacSystem} · ${c.lunarNodeType} Node · ${c.blackMoonLilithType} Lilith · ${c.lotCalculationMethod} lots`;
      settings.set(label, [...(settings.get(label) ?? []), p]);
    }
  }
  return { reasons: [...reasons.entries()], settings: [...settings.entries()] };
}
/** A review never silently grows, or follows a changed snapshot/assessment. */
export function sameReview(selection: ConversionPreview[], records: ArchivedChart[], previews: ConversionPreview[]) {
  return selection.every(p => records.some(r => r.transferId === p.transferId && r.snapshotId === p.snapshotId) &&
    previews.some(current => current.transferId === p.transferId && JSON.stringify(current) === JSON.stringify(p)));
}
