/** Mercurial chart behavior translated to UI-thread worklets. Offsets are in
 * viewport points; scaling is about the wheel center. No React frame updates.
 * Source: Mercurial Transform/GestureCoordinator/MomentumAnimator + iOS wheel.
 * Friction is normalized to 60 Hz here (Swift applied .95 once per frame). */
export interface Point { x: number; y: number }
export interface WheelTransform { scale: number; x: number; y: number }
export interface Touch extends Point { id: number }
export const IDENTITY: WheelTransform = { scale: 1, x: 0, y: 0 };
export const MOTION = { min: 1, max: 3, friction: .95, stiffness: 900, damping: 60,
  rubberLimit: 240, rubberCoefficient: .55, minimumVelocity: 50, maxVelocity: 2500 };

export function clamp(value: number, min: number, max: number) {
  'worklet'; return Math.min(max, Math.max(min, value));
}
export function panLimit(size: number, scale: number) {
  'worklet'; return size * (scale - 1) / 2;
}
export function toCanvas(point: Point, transform: WheelTransform, size: number): Point {
  'worklet'; const center = size / 2;
  return { x: (point.x - center - transform.x) / transform.scale + center,
    y: (point.y - center - transform.y) / transform.scale + center };
}
export function zoomAt(transform: WheelTransform, scale: number, anchor: Point, size: number): WheelTransform {
  'worklet'; scale = clamp(scale, MOTION.min, MOTION.max);
  const point = toCanvas(anchor, transform, size), center = size / 2;
  return { scale, x: anchor.x - center - (point.x - center) * scale,
    y: anchor.y - center - (point.y - center) * scale };
}
export function constrain(transform: WheelTransform, size: number): WheelTransform {
  'worklet'; const limit = panLimit(size, transform.scale);
  return { scale: transform.scale, x: clamp(transform.x, -limit, limit), y: clamp(transform.y, -limit, limit) };
}
export function rubber(value: number, limit: number) {
  'worklet'; const edge = clamp(value, -limit, limit), extra = value - edge;
  return edge + Math.sign(extra) * (1 - 1 / (Math.abs(extra) * MOTION.rubberCoefficient / MOTION.rubberLimit + 1)) * MOTION.rubberLimit;
}
function unRubber(value: number, limit: number) {
  'worklet'; const edge = clamp(value, -limit, limit), extra = value - edge;
  const distance = Math.min(Math.abs(extra), MOTION.rubberLimit - .001);
  return edge + Math.sign(extra) * distance * MOTION.rubberLimit / (MOTION.rubberCoefficient * (MOTION.rubberLimit - distance));
}
export function touchGeometry(touches: Touch[]) {
  'worklet'; const sorted = touches.slice().sort((a, b) => a.id - b.id).slice(0, 2);
  const a = sorted[0], b = sorted[1] ?? a;
  return { key: sorted.map(t => t.id).join(','), count: sorted.length,
    x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, distance: Math.hypot(a.x - b.x, a.y - b.y) };
}
export interface Drag {
  key: string; count: number; base: WheelTransform; anchor: Point; distance: number;
  last: Point; time: number; velocity: Point; pan: number; zoom: number;
}
export function beginDrag(touches: Touch[], transform: WheelTransform, now: number): Drag {
  'worklet'; const g = touchGeometry(touches);
  return { key: g.key, count: g.count, base: transform, anchor: { x: g.x, y: g.y }, distance: g.distance,
    last: { x: g.x, y: g.y }, time: now, velocity: { x: 0, y: 0 }, pan: 0, zoom: 0 };
}
export function moveDrag(drag: Drag, touches: Touch[], current: WheelTransform, now: number, size: number) {
  'worklet'; const g = touchGeometry(touches);
  // Rebase on pointer identity, not just count: removing/replacing a finger
  // must never inject a centroid jump or a fling.
  if (g.key !== drag.key) return { drag: beginDrag(touches, current, now), transform: current };
  const ratio = drag.count === 2 && drag.distance > 0 ? g.distance / drag.distance : 1;
  // The captured transform is already rubber-banded. Recover its raw offset
  // before applying resistance again, so a pointer handoff cannot shrink it.
  const baseLimit = panLimit(size, drag.base.scale);
  const base = { ...drag.base, x: unRubber(drag.base.x, baseLimit), y: unRubber(drag.base.y, baseLimit) };
  const next = zoomAt(base, base.scale * ratio, drag.anchor, size);
  next.x += g.x - drag.anchor.x; next.y += g.y - drag.anchor.y;
  const limit = panLimit(size, next.scale);
  next.x = rubber(next.x, limit); next.y = rubber(next.y, limit);
  const dt = (now - drag.time) / 1000;
  const dx = g.x - drag.last.x, dy = g.y - drag.last.y;
  let velocity = drag.velocity;
  if (dt > 0 && dt < .5) {
    velocity = { x: .7 * velocity.x + .3 * dx / dt, y: .7 * velocity.y + .3 * dy / dt };
    const speed = Math.hypot(velocity.x, velocity.y);
    if (speed > MOTION.maxVelocity) velocity = { x: velocity.x * MOTION.maxVelocity / speed, y: velocity.y * MOTION.maxVelocity / speed };
  }
  return { transform: next, drag: { ...drag, last: { x: g.x, y: g.y }, time: now, velocity,
    pan: drag.pan + Math.hypot(dx, dy), zoom: drag.zoom + Math.abs(next.scale - current.scale) } };
}
export function releaseVelocity(drag: Drag, now: number): Point {
  'worklet'; if (now - drag.time > 100) return { x: 0, y: 0 };
  // Pure zoom has no fling; mixed pinch+translation weights momentum by intent.
  const intent = drag.count === 1 ? 1 : drag.pan / Math.max(.001, drag.pan + drag.zoom * 200);
  if (intent < .3) return { x: 0, y: 0 };
  return { x: drag.velocity.x * intent, y: drag.velocity.y * intent };
}
// Exact critically damped spring integration stays stable even on a slow frame.
// k=900, c=60, mass=1 gives a quick return without oscillation.
function advanceAxis(position: number, velocity: number, limit: number, dt: number) {
  'worklet'; const target = clamp(position, -limit, limit), displacement = position - target;
  if (Math.abs(displacement) > .001) {
    const omega = Math.sqrt(MOTION.stiffness), decay = Math.exp(-omega * dt);
    const coefficient = velocity + omega * displacement;
    const next = (displacement + coefficient * dt) * decay;
    const speed = (velocity - omega * coefficient * dt) * decay;
    if (next * displacement <= 0 || (Math.abs(next) < .5 && Math.abs(speed) < 5)) return { position: target, velocity: 0 };
    return { position: target + next, velocity: speed };
  }
  if (displacement !== 0) return { position: target, velocity: 0 };
  const friction = Math.pow(MOTION.friction, dt * 60);
  const speed = velocity * friction;
  return { position: position + velocity * dt, velocity: Math.abs(speed) < MOTION.minimumVelocity ? 0 : speed };
}
export function momentumStep(transform: WheelTransform, velocity: Point, seconds: number, size: number) {
  'worklet'; const dt = clamp(seconds, 0, 1 / 15), limit = panLimit(size, transform.scale);
  const x = advanceAxis(transform.x, velocity.x, limit, dt);
  const y = advanceAxis(transform.y, velocity.y, limit, dt);
  return { transform: { ...transform, x: x.position, y: y.position }, velocity: { x: x.velocity, y: y.velocity },
    active: x.velocity !== 0 || y.velocity !== 0 || Math.abs(x.position) > limit || Math.abs(y.position) > limit };
}
