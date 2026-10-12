import type { ChartCount, DisplayPreset } from '../display/model';
export interface StarChartContext { id: string; name: string; status?: string; missingStars?: string[] }
export interface StarRingTarget { layout: ChartCount; chartId?: string; sourceSlot?: number }
export interface StarRingGuidance { message: string; manageable: boolean; sourceSlot?: number }
/** Resolve stable chart identity against live slots. Configuration never promises rendering. */
export function starRingGuidance(preset: DisplayPreset, charts: StarChartContext[], target: StarRingTarget): StarRingGuidance {
  const { layout } = target;
  const index = target.chartId ? charts.findIndex(chart => chart.id === target.chartId) : -1;
  if (target.chartId && index < 0) return { message: 'The chart that opened this library is no longer open. Fixed-star rings control how your library appears; open Display to choose a layout and chart source.', manageable: false };
  const sourceSlot = target.chartId ? index + 1 : target.sourceSlot;
  if (sourceSlot && sourceSlot > layout) return { message: 'This chart is outside the editing layout. Choose a layout containing it in Display → Details → Rings.', manageable: false };
  const layoutName = `${layout}-chart layout${layout !== charts.length ? ' · editing an inactive layout' : ''}`;
  const rings = preset.layouts[layout].rings.filter(ring => ring.kind === 'fixedStars');
  const matching = rings.filter(ring => !sourceSlot || ('sourceSlot' in ring && ring.sourceSlot === sourceSlot));
  const chart = sourceSlot ? charts[sourceSlot - 1] : undefined;
  const subject = chart ? `${chart.name} · Chart ${sourceSlot} · ${layoutName}` : sourceSlot ? `Chart ${sourceSlot} · ${layoutName}` : layoutName;
  let message: string;
  if (!matching.some(ring => ring.enabled)) {
    message = `${subject}: ${matching.length ? 'its fixed-star ring is hidden.' : 'no fixed-star ring is configured for this source.'}`;
    if (!sourceSlot) message = `${subject}: ${rings.length ? 'fixed-star rings are hidden.' : 'no fixed-star ring is configured.'}`;
    if (sourceSlot && rings.some(ring => ring.enabled)) message += ' Another chart source has an enabled ring.';
  } else {
    const slots = [...new Set(matching.filter(ring => ring.enabled).map(ring => 'sourceSlot' in ring ? ring.sourceSlot : 0))];
    message = `${subject}: a fixed-star ring is enabled${!sourceSlot ? ` for ${slots.map(slot => `Chart ${slot}`).join(', ')}` : ''}. This configures presentation; chart calculations determine the positions.`;
  }
  const affected = chart ? [chart] : charts.slice(0, layout);
  const failed = affected.filter(chart => chart.status === 'error');
  const missing = affected.filter(chart => chart.missingStars?.length);
  if (failed.length) message += ` Calculation failed for ${failed.map(chart => chart.name).join(', ')}; retry it from the chart.`;
  else if (affected.some(chart => chart.status === 'loading')) message += ' Chart positions are updating.';
  if (missing.length) message += ` Could not calculate: ${missing.map(chart => `${chart.name}: ${chart.missingStars!.join(', ')}`).join('; ')}.`;
  return { message, manageable: true, sourceSlot };
}
