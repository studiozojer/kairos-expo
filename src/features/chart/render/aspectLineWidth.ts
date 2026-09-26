/** Orb weighting changes geometry only, independently of engine strength and
 * opacity. The small chart-unit floor never makes a line thicker than its base. */
export function aspectLineWidth(base: number, weighting: number, orb: number, allowedOrb: number): number {
  const weight = Number.isFinite(weighting) ? Math.max(0, Math.min(1, weighting)) : 0;
  if (weight === 0 || !Number.isFinite(orb) || !Number.isFinite(allowedOrb)) return base;
  const closeness = orb === 0 ? 1 : allowedOrb > 0 ? Math.max(0, 1 - Math.abs(orb) / allowedOrb) : 0;
  return Math.max(Math.min(base, 0.15), base * (1 - weight + weight * closeness * closeness));
}
