import type { Preset } from '../schema/preset';
import { CHART_SLOTS, updateOrientation } from '../display/sharedControls';

export type OrientationMode = 'static' | 'ascendant';
export function rotateOrientation(preset: Preset, chartCount: number, mode: OrientationMode, ascendant: number | undefined, direction: -1 | 1): Preset {
  const slot = CHART_SLOTS[Math.max(0, Math.min(2, chartCount - 1))];
  const fixed = preset[slot].globalSettings.staticOrientationDegree;
  const degree = mode === 'ascendant' && ascendant !== undefined && Number.isFinite(ascendant) ? ascendant : fixed;
  const sign = Math.floor((((degree % 360) + 360) % 360) / 30);
  return updateOrientation(preset, ((sign + direction + 12) % 12) * 30);
}
/** Reset the editable orientation only; unrelated live edits and mode survive. */
export function resetOrientation(preset: Preset, baseline: Preset): Preset {
  const next = { ...preset };
  for (const slot of CHART_SLOTS) next[slot] = {
    ...preset[slot], globalSettings: { ...preset[slot].globalSettings,
      staticOrientationDegree: baseline[slot].globalSettings.staticOrientationDegree },
  };
  return next;
}
