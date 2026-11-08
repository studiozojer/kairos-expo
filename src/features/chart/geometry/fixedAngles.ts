import type { ChartRenderingConfiguration } from '../config/ChartRenderingConfiguration';
import type { WheelLayout, PlanetRingLayout } from '../render/useWheelLayout';
import type { GlyphName } from '../render/glyph-map.gen';
import { boxesOverlap, type LabelBox } from './angleLabels';

export function fixedAngleMarkers(config: ChartRenderingConfiguration, layout: Pick<WheelLayout, 'rings' | 'geometry' | 'coordinates' | 'displayScale'>) {
  if (!config.angleOverlay?.enabled) return [];
  const { geometry, coordinates, displayScale: scale, rings } = layout;
  const zodiac = rings.findIndex(r => r.type.kind === 'zodiacSigns');
  return (config.angleFrames ?? []).flatMap(frame => {
    const index = rings.findIndex(r => r.type.kind === 'planets' && r.type.ringNumber === frame.ringNumber);
    if (index < 0) return [];
    const inner = geometry.innerRadiusForRing(index), outer = geometry.radiusForRing(index);
    const mode = config.angleOverlay!.labels;
    const radius = mode === 'outside' ? geometry.radiusForRing(0) + 12 * scale
      : mode === 'zodiac' && zodiac >= 0 ? geometry.midRadiusForRing(zodiac) : inner + 12 * scale;
    return frame.placements.filter(p => Number.isFinite(p.longitude)).map(p => {
      const center = coordinates.pointForDegree(p.longitude, radius);
      return { id: `${frame.ringNumber}-${p.id}`, longitude: p.longitude, inner, outer, center,
        glyph: `celestials/${p.glyphAsset}` as GlyphName,
        box: { x: center.x - 10 * scale, y: center.y - 10 * scale, width: 20 * scale, height: 20 * scale } };
    });
  });
}

/** Reserve immutable angle footprints after ordinary planet spacing. Search only
 * within each body's authored house/sign window; preserve astronomical ticks.
 * If no free candidate exists, retain the placement and report its ID. */
export function avoidFixedAngles(positions: PlanetRingLayout, obstacles: LabelBox[], center: { x: number; y: number }, padding: number) {
  const result = [...positions];
  const unresolved: string[] = [];
  const bounds = (p: PlanetRingLayout[number]): LabelBox => {
    const points = [p.adjustedPosition, p.connectionEndpoint, p.farSideConnectionEndpoint];
    const xs = points.map(v => v.x), ys = points.map(v => v.y);
    return { x: Math.min(...xs) - padding, y: Math.min(...ys) - padding,
      width: Math.max(...xs) - Math.min(...xs) + 2 * padding, height: Math.max(...ys) - Math.min(...ys) + 2 * padding };
  };
  for (let i = 0; i < result.length; i++) {
    const current = result[i];
    if (!obstacles.some(o => boxesOverlap(bounds(current), o))) continue;
    const baseAngle = Math.atan2(current.adjustedPosition.y - center.y, current.adjustedPosition.x - center.x);
    const trueAngle = Math.atan2(current.originalPosition.y - center.y, current.originalPosition.x - center.x);
    const adjustedLongitude = current.placement.longitude - (baseAngle - trueAngle) * 180 / Math.PI;
    let found = false;
    for (let step = 1; step <= 360 && !found; step++) for (const direction of [1, -1]) {
      const delta = direction * step * 0.5;
      const degree = ((adjustedLongitude + delta) % 360 + 360) % 360;
      const { windowLo, windowHi } = current.placement;
      if (windowLo !== undefined && windowHi !== undefined) {
        const unwrapped = degree + 360 * Math.ceil((windowLo - degree) / 360);
        if (unwrapped > windowHi) continue;
      }
      const radians = -delta * Math.PI / 180;
      const rotate = (p: { x: number; y: number }) => ({
        x: center.x + (p.x - center.x) * Math.cos(radians) - (p.y - center.y) * Math.sin(radians),
        y: center.y + (p.x - center.x) * Math.sin(radians) + (p.y - center.y) * Math.cos(radians),
      });
      const candidate = { ...current, adjustedPosition: rotate(current.adjustedPosition),
        connectionEndpoint: rotate(current.connectionEndpoint), farSideConnectionEndpoint: rotate(current.farSideConnectionEndpoint), needsConnectionLine: true };
      const box = bounds(candidate);
      if (obstacles.some(o => boxesOverlap(box, o)) || result.some((other, j) => i !== j && boxesOverlap(box, bounds(other)))) continue;
      result[i] = candidate; found = true; break;
    }
    if (!found) unresolved.push(current.placement.id);
  }
  return { positions: result, unresolved };
}
