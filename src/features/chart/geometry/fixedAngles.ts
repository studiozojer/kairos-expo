import { PLANETS_STYLE_TYPE, PLANETS_RING_STYLE_DEFAULT } from '../schema/ring-styles';
import { DegreeTextStack } from './DegreeTextStack';
import type { PlanetsRingStyle } from '../schema/ring-styles';
import { degreesInSign, minutesInSign } from '../config/engine-types';
import type { ChartRenderingConfiguration } from '../config/ChartRenderingConfiguration';
import type { WheelLayout, PlanetRingLayout } from '../render/useWheelLayout';
import type { GlyphName } from '../render/glyph-map.gen';
import { boxesOverlap, type LabelBox } from './angleLabels';


export type FixedAngleObstacle = LabelBox | { from: { x: number; y: number }; to: { x: number; y: number }; padding: number };

/** Segment against an expanded rectangle: narrow diagonal strokes must not
 * reserve their entire bounding rectangle. Padding includes stroke half-width. */
export function intersectsFixedObstacle(box: LabelBox, obstacle: FixedAngleObstacle): boolean {
  if (!('from' in obstacle)) return boxesOverlap(box, obstacle);
  let enter = 0, leave = 1;
  for (const axis of ['x', 'y'] as const) {
    const min = box[axis] - obstacle.padding;
    const max = box[axis] + (axis === 'x' ? box.width : box.height) + obstacle.padding;
    const start = obstacle.from[axis], delta = obstacle.to[axis] - start;
    if (Math.abs(delta) < 1e-9) { if (start < min || start > max) return false; continue; }
    const a = (min - start) / delta, b = (max - start) / delta;
    enter = Math.max(enter, Math.min(a, b)); leave = Math.min(leave, Math.max(a, b));
    if (enter > leave) return false;
  }
  return true;
}

export function fixedAngleObstacles(markers: ReturnType<typeof fixedAngleMarkers>, scale: number): FixedAngleObstacle[] {
  return markers.flatMap(marker => [marker.box, { from: marker.strokeStart, to: marker.strokeEnd, padding: 2 * scale }]);
}

export function fixedAngleMarkers(config: ChartRenderingConfiguration, layout: Pick<WheelLayout, 'rings' | 'geometry' | 'coordinates' | 'displayScale'>) {
  if (!config.angleOverlay?.enabled) return [];
  const { geometry, coordinates, displayScale: scale, rings } = layout;
  const zodiac = rings.findIndex(r => r.type.kind === 'zodiacSigns');
  return (config.angleFrames ?? []).flatMap(frame => {
    const index = rings.findIndex(r => r.type.kind === 'planets' && r.type.ringNumber === frame.ringNumber);
    if (index < 0) return [];
    const inner = geometry.innerRadiusForRing(index), outer = geometry.radiusForRing(index);
    const style = rings[index].style.$type === PLANETS_STYLE_TYPE ? rings[index].style : PLANETS_RING_STYLE_DEFAULT;
    const requestedMode = config.angleOverlay!.labels;
    const mode = requestedMode === 'zodiac' && zodiac < 0 ? 'inner' : requestedMode;
    const radius = mode === 'outside' ? geometry.radiusForRing(0) + 12 * scale
      : mode === 'zodiac' && zodiac >= 0 ? geometry.midRadiusForRing(zodiac) : inner + 12 * scale;
    return frame.placements.filter(p => Number.isFinite(p.longitude)).map(p => {
      const center = coordinates.pointForDegree(p.longitude, radius);
      const direction = mode === 'inner' ? 1 : -1;
      const radians = coordinates.zodiacToCanvasAngle(p.longitude) * Math.PI / 180;
      const ux = Math.abs(Math.cos(radians)), uy = Math.abs(Math.sin(radians));
      let cursor = 9 * scale;
      if (mode === 'zodiac' && zodiac >= 0) cursor = Math.max(cursor, radius - geometry.innerRadiusForRing(zodiac) + 2 * scale);
      const values = [
        ...(style.showDegreeText ? [{ text: `${degreesInSign(p.longitude)}°`, size: style.degreeTextFontSize }] : []),
        ...(style.showMinuteText ? [{ text: `${String(minutesInSign(p.longitude)).padStart(2, '0')}'`, size: style.degreeTextFontSize * 0.8 }] : []),
      ];
      const boxes: LabelBox[] = [{ x: center.x - 10 * scale, y: center.y - 10 * scale, width: 20 * scale, height: 20 * scale }];
      const annotations = values.map(value => {
        // Fraktion Mono advances are below 0.7 em. Reserve the projected
        // upright text box along the spoke, including horizontal stacks.
        const width = value.text.length * value.size * 0.7 + 2 * scale;
        const height = value.size * 1.2 + 2 * scale;
        const halfExtent = (ux * width + uy * height) / 2;
        cursor += Math.max(2 * scale, style.degreeTextLineSpacing) + halfExtent;
        const position = coordinates.pointForDegree(p.longitude, radius + direction * cursor);
        cursor += halfExtent;
        boxes.push({ x: position.x - width / 2, y: position.y - height / 2, width, height });
        return { ...value, center: position };
      });
      const left = Math.min(...boxes.map(b => b.x)), top = Math.min(...boxes.map(b => b.y));
      const strokeInner = Math.min(mode === 'inner' ? radius + cursor + 2 * scale : inner, outer);
      const strokeOuter = Math.max(mode === 'inner' ? outer : Math.min(outer, radius - cursor - 2 * scale), inner);
      return { strokeStart: coordinates.pointForDegree(p.longitude, strokeInner), strokeEnd: coordinates.pointForDegree(p.longitude, strokeOuter), id: `${frame.ringNumber}-${p.id}`, longitude: p.longitude, inner, outer, center, annotations,
        textColor: style.degreeTextColor,
        glyph: `celestials/${p.glyphAsset}` as GlyphName,
        box: { x: left, y: top, width: Math.max(...boxes.map(b => b.x + b.width)) - left, height: Math.max(...boxes.map(b => b.y + b.height)) - top } };

    });
  });
}

/** Reserve immutable angle footprints after ordinary planet spacing. Search only
 * within each body's authored house/sign window; preserve astronomical ticks.
 * Ordering takes precedence over clearance. If no free candidate exists,
 * retain an order-preserving placement and report its ID. */
export function avoidFixedAngles(positions: PlanetRingLayout, obstacles: FixedAngleObstacle[], center: { x: number; y: number }, padding: number, style?: PlanetsRingStyle, fixedLongitudes: number[] = []) {
  const result = [...positions];
  const unresolved: string[] = [];
  const bounds = (p: PlanetRingLayout[number]): LabelBox => {
    const points = [p.adjustedPosition, p.connectionEndpoint, p.farSideConnectionEndpoint];
    const xs = points.map(v => v.x), ys = points.map(v => v.y);
    return { x: Math.min(...xs) - padding, y: Math.min(...ys) - padding,
      width: Math.max(...xs) - Math.min(...xs) + 2 * padding, height: Math.max(...ys) - Math.min(...ys) + 2 * padding };
  };
  const footprints = (p: PlanetRingLayout[number]): LabelBox[] => {
    if (!style) return [bounds(p)];
    const glyphSize = style.useGlyphs ? style.glyphSize : style.circleRadius * 2;
    const gap = Math.max(0, padding - style.glyphSize / 2);
    const box = (x: number, y: number, width: number, height: number) => ({
      x: x - width / 2 - gap, y: y - height / 2 - gap, width: width + 2 * gap, height: height + 2 * gap,
    });
    const { x, y } = p.adjustedPosition;
    const radius = Math.hypot(x - center.x, y - center.y) || 1;
    const direction = style.invertGlyphOrder !== style.anchorFromInnerEdge ? 1 : -1;
    return [box(x, y, glyphSize, glyphSize), ...DegreeTextStack.stackElements(style, p.placement.isRetrograde).map(element => {
      const isText = element.kind === 'degrees' || element.kind === 'minutes';
      const text = element.kind === 'degrees' ? `${degreesInSign(p.placement.longitude)}°` : `${String(minutesInSign(p.placement.longitude)).padStart(2, '0')}'`;
      return box(x + direction * (x - center.x) / radius * element.centerOffset,
        y + direction * (y - center.y) / radius * element.centerOffset,
        isText ? text.length * element.size * 0.7 : element.size,
        isText ? element.size * 1.2 : element.size);
    })];
  };
  const hitsObstacle = (p: PlanetRingLayout[number]) => footprints(p).some(box => obstacles.some(o => intersectsFixedObstacle(box, o)));
  const stacksOverlap = (a: PlanetRingLayout[number], b: PlanetRingLayout[number]) =>
    footprints(a).some(box => footprints(b).some(other => boxesOverlap(box, other)));
  // Resolve in zodiac order, allowing a displaced body to push later neighbors
  // instead of treating every still-unresolved neighbor as immovable.
  const order = result.map((_, index) => index).sort((a, b) =>
    ((result[a].placement.longitude % 360 + 360) % 360) - ((result[b].placement.longitude % 360 + 360) % 360));
  const accepted = new Set<number>();
  for (const i of order) {
    let current = result[i];
    const longitude = current.placement.longitude;
    const signed = (degrees: number) => ((degrees + 180) % 360 + 360) % 360 - 180;
    const displayedOffset = (p: PlanetRingLayout[number]) => signed(-(
      Math.atan2(p.adjustedPosition.y - center.y, p.adjustedPosition.x - center.x) -
      Math.atan2(p.originalPosition.y - center.y, p.originalPosition.x - center.x)) * 180 / Math.PI);
    let lo = -180, hi = 180;
    const restrict = (other: number, displayed = other) => {
      const forward = ((other - longitude) % 360 + 360) % 360;
      if (forward < 1e-8 || 360 - forward < 1e-8) { lo = Math.max(lo, 0); hi = Math.min(hi, 0); return; }
      const shift = signed(displayed - other);
      lo = Math.max(lo, forward - 360 + shift + 1e-6);
      hi = Math.min(hi, forward + shift - 1e-6);
    };
    // True neighboring longitudes reserve room for their fallback placements.
    // Accepted positions additionally prevent overtaking displaced neighbors.
    positions.forEach((p, j) => { if (j !== i) restrict(p.placement.longitude); });
    result.forEach((p, j) => { if (accepted.has(j)) restrict(p.placement.longitude, p.placement.longitude + displayedOffset(p)); });
    fixedLongitudes.forEach(degree => restrict(degree));
    const withinWindow = (offset: number) => {
      if (offset < lo || offset > hi) return false;
      const { windowLo, windowHi } = current.placement;
      if (windowLo === undefined || windowHi === undefined) return true;
      const degree = ((longitude + offset) % 360 + 360) % 360;
      return degree + 360 * Math.ceil((windowLo - degree) / 360) <= windowHi;
    };
    // The upstream planet-only layout may already have crossed a fixed angle.
    // Correct that before searching, so an unsatisfiable layout stays truthful.
    const initialOffset = displayedOffset(current);
    if (!withinWindow(initialOffset)) {
      const radians = initialOffset * Math.PI / 180;
      const rotate = (p: { x: number; y: number }) => ({
        x: center.x + (p.x - center.x) * Math.cos(radians) - (p.y - center.y) * Math.sin(radians),
        y: center.y + (p.x - center.x) * Math.sin(radians) + (p.y - center.y) * Math.cos(radians),
      });
      current = { ...current, adjustedPosition: rotate(current.adjustedPosition), connectionEndpoint: rotate(current.connectionEndpoint), farSideConnectionEndpoint: rotate(current.farSideConnectionEndpoint) };
      result[i] = current;
    }
    if (!hitsObstacle(current) &&
      !result.some((other, j) => accepted.has(j) && stacksOverlap(current, other))) {
      accepted.add(i); continue;
    }
    const baseAngle = Math.atan2(current.adjustedPosition.y - center.y, current.adjustedPosition.x - center.x);
    const trueAngle = Math.atan2(current.originalPosition.y - center.y, current.originalPosition.x - center.x);
    const adjustedLongitude = current.placement.longitude - (baseAngle - trueAngle) * 180 / Math.PI;
    let found = false;
    for (let step = 0; step <= 360 && !found; step++) for (const direction of [1, -1]) {
      const offset = direction * step * 0.5;
      const delta = current.placement.longitude + offset - adjustedLongitude;
      if (!withinWindow(offset)) continue;
      const radians = -delta * Math.PI / 180;
      const rotate = (p: { x: number; y: number }) => ({
        x: center.x + (p.x - center.x) * Math.cos(radians) - (p.y - center.y) * Math.sin(radians),
        y: center.y + (p.x - center.x) * Math.sin(radians) + (p.y - center.y) * Math.cos(radians),
      });
      const candidate = { ...current, adjustedPosition: rotate(current.adjustedPosition),
        connectionEndpoint: rotate(current.connectionEndpoint), farSideConnectionEndpoint: rotate(current.farSideConnectionEndpoint), needsConnectionLine: true };
      if (hitsObstacle(candidate) || result.some((other, j) => accepted.has(j) && stacksOverlap(candidate, other))) continue;
      result[i] = candidate; found = true; break;
    }
    if (!found) unresolved.push(current.placement.id);
    accepted.add(i);
  }
  return { positions: result, unresolved };
}
