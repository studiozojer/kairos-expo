import type { Theme } from '@/theme';
import type { ActiveChart } from '../active/model';
import type { ActiveCalculation } from '../active/ActiveChartsContext';
import type { ChartRenderingConfiguration } from '../config/ChartRenderingConfiguration';
import type { SelectionStyleOverride } from '../schema/preset';

export type ExportVariant = 'full' | 'wheel';
export type ExportRequest = { variant: ExportVariant; destination: 'share' | 'photos' };
export interface ExportCard { id: string; name: string; date: string; time: string; location: string }
export interface ChartExportSnapshot {
  config: ChartRenderingConfiguration; selectedIds: string[]; selectionStyle: SelectionStyleOverride;
  theme: Theme; width: number; cards: ExportCard[];
}

/** Metadata belongs to the result on the wheel, which can lag the stepper. */
export function exportCards(charts: ActiveChart[], calculations: Record<string, ActiveCalculation>): ExportCard[] {
  return charts.map(chart => {
    const result = calculations[chart.id]?.result;
    if (!result) throw new Error('Wait for every chart to finish loading before exporting.');
    const timezone = result.settings.location.timezone;
    const time = new Date(result.datetime);
    return { id: chart.id, name: chart.name,
      date: new Intl.DateTimeFormat(undefined, { timeZone: timezone, year: 'numeric', month: 'short', day: 'numeric' }).format(time),
      time: new Intl.DateTimeFormat(undefined, { timeZone: timezone, hour: 'numeric', minute: '2-digit' }).format(time),
      location: result.settings.location.name };
  });
}

export function snapshotExport(input: ChartExportSnapshot): ChartExportSnapshot {
  // Render configurations are JSON data. Copy so in-flight recalculation or a
  // later preset edit cannot change an export after permission prompts open.
  return JSON.parse(JSON.stringify(input)) as ChartExportSnapshot;
}
export function exportLayout(snapshot: ChartExportSnapshot, variant: ExportVariant) {
  const width = Math.round(snapshot.width) + 32;
  const wheel = width - 8;
  const cardHeight = Math.ceil(snapshot.theme.type.whyteSm.lineHeight + 3 * snapshot.theme.type.whyteXs.lineHeight + 22);
  const height = variant === 'wheel' ? width : wheel + 32 + (snapshot.cards.length ? 16 + cardHeight : 0);
  return { width, height, wheel, cardHeight, scale: 6, pixelWidth: width * 6, pixelHeight: height * 6 };
}
