import { obj, oneOf, bool } from './decode';

/** Optional additive preset field. Absence preserves the existing glyph presentation. */
export interface AngleOverlayConfiguration {
  enabled: boolean;
  labels: 'inner' | 'zodiac' | 'outside';
}
export function parseAngleOverlay(value: unknown): AngleOverlayConfiguration {
  const o = obj(value);
  return { enabled: bool(o.enabled, false), labels: oneOf(o.labels, ['inner', 'zodiac', 'outside'] as const, 'outside') };
}
export const ANGLE_NAMES: Readonly<Record<string, string>> = {
  ascendant: 'ASC', descendant: 'DSC', midheaven: 'MC', imumCoeli: 'IC',
};
export const isAxisAngle = (bodyId: string) => Object.prototype.hasOwnProperty.call(ANGLE_NAMES, bodyId);
