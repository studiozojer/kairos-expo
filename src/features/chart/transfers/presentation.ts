import type { ConversionPreview } from './conversion';
import type { ArchivedChart } from './types';
export const isChartException = (preview: ConversionPreview) => ['unsupported', 'needs_review', 'source_changed'].includes(preview.state);
export const chartExceptions = (previews: ConversionPreview[], records: ArchivedChart[]) => previews.filter(p => isChartException(p) && records.some(r => r.transferId === p.transferId && r.snapshotId === p.snapshotId));
export const exceptionReason = (reason?: string): string => ({
  source_changed: 'The original has changed. Your saved copy has been kept unchanged.',
  sidereal_or_unknown_zodiac: 'This chart uses a zodiac system that isn’t supported yet.',
  date_range: 'This chart’s date is outside the supported range (1900–2099).',
  unsupported_location: 'This chart’s location isn’t supported yet.',
  unknown_timezone: 'This chart’s timezone isn’t supported yet.',
  unreadable_source: 'The old chart’s calculation data couldn’t be read.',
  unreadable_zodiac: 'The old chart’s zodiac setting couldn’t be read.',
  derived_or_unknown_source: 'This chart’s calculation type isn’t supported yet.',
  derived_or_ephemeral_chart: 'This chart’s calculation type isn’t supported yet.',
  source_input_disagreement: 'This chart contains conflicting calculation inputs.',
  unsupported_captured_settings: 'This chart uses calculation settings that aren’t supported yet.',
  setting_disagreement: 'This chart contains conflicting calculation settings.',
  unknown_house_system: 'This chart’s house system isn’t supported yet.',
  unresolved_tags: 'Some of this chart’s tags couldn’t be recovered.',
  unsupported_tags: 'Some of this chart’s tags couldn’t be recovered.',
  metadata_limit: 'Some of this chart’s saved information isn’t supported yet.',
}[reason ?? ''] ?? 'This chart needs additional compatibility support.');
