import type { AspectEdgeDTO, Placement } from '../config/engine-types';
import type { AspectConfiguration } from '../schema/preset';
import { ASPECT_TYPES } from '../schema/enums.gen';
import { resolveAspectType } from './AspectFilter';

const separation = (a: number, b: number) => Math.abs(((a - b) % 360 + 540) % 360 - 180);

/** All chart pairs are valid, including the same body in different charts.
 * IDs have already been qualified by stable instance identity at this boundary.
 * Other aspect display filters remain in AspectFilter, shared with engine edges.
 */
export function calculateCrossChartAspects(
  from: readonly Placement[], to: readonly Placement[], config: AspectConfiguration,
): AspectEdgeDTO[] {
  const types = config.enabledTypes.flatMap(name => {
    const type = resolveAspectType(name);
    if (!type) return [];
    const orb = config.orbs.orbs[type.wireName] ?? ASPECT_TYPES[type.key].defaultOrb;
    return Number.isFinite(orb) && orb >= 0 ? [{ ...type, orb }] : [];
  });
  const edges: AspectEdgeDTO[] = [];
  for (const a of from) for (const b of to) {
    const angle = separation(a.longitude, b.longitude);
    for (const type of types) {
      const delta = angle - type.angle;
      if (Math.abs(delta) > type.orb) continue;
      // A short forward sample handles retrograde motion and angular wrapping.
      // This describes instantaneous relative motion, independent of which
      // chart the time stepper happens to target.
      const nextAngle = separation(a.longitude + a.speedLongitude / 86400, b.longitude + b.speedLongitude / 86400);
      edges.push({ from: a.id, to: b.id, aspect_type: type.wireName, orb: -delta,
        strength: type.orb === 0 ? 1 : Math.max(0, 1 - Math.abs(delta) / type.orb),
        is_applying: Math.abs(nextAngle - type.angle) < Math.abs(delta),
      });
      break;
    }
  }
  return edges;
}
