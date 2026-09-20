import { beginDrag, constrain, IDENTITY, momentumStep, moveDrag, panLimit, releaseVelocity, rubber, toCanvas, zoomAt } from '../motion';

const size = 400;
test('pinching preserves the point under the fingers, including at the scale cap', () => {
  const before = { scale: 1.5, x: 24, y: -32 }, anchor = { x: 310, y: 140 };
  for (const scale of [2, 3, 8, .1]) {
    const after = zoomAt(before, scale, anchor, size);
    expect(toCanvas(anchor, after, size)).toEqual(toCanvas(anchor, before, size));
    expect(after.scale).toBeGreaterThanOrEqual(1);
    expect(after.scale).toBeLessThanOrEqual(3);
  }
});
test('Mercurial content bounds become viewport bounds and return to zero at 1x', () => {
  expect(panLimit(400, 3)).toBe(400);
  expect(constrain({ scale: 2, x: 500, y: -500 }, 400)).toEqual({ scale: 2, x: 200, y: -200 });
  expect(constrain({ scale: 1, x: 90, y: 20 }, 400)).toEqual(IDENTITY);
});
test('rubber band is continuous at the edge, symmetric, and has a finite asymptote', () => {
  expect(rubber(200, 200)).toBe(200);
  expect(rubber(210, 200)).toBeGreaterThan(200);
  expect(rubber(210, 200)).toBeLessThan(210);
  expect(rubber(-210, 200)).toBe(-rubber(210, 200));
  expect(rubber(1e8, 200)).toBeLessThan(440);
});
test('pinch + centroid translation tracks together, not as competing gestures', () => {
  const initial = [{ id: 1, x: 150, y: 200 }, { id: 2, x: 250, y: 200 }];
  const drag = beginDrag(initial, IDENTITY, 0);
  const result = moveDrag(drag, [{ id: 1, x: 120, y: 220 }, { id: 2, x: 320, y: 220 }], IDENTITY, 16, size);
  expect(result.transform).toEqual({ scale: 2, x: 20, y: 20 });
});
test('2→1→2 handoff and a replacement pointer keep the existing transform', () => {
  let current = { scale: 2, x: 25, y: 30 };
  let drag = beginDrag([{ id: 1, x: 120, y: 200 }, { id: 2, x: 320, y: 200 }], current, 0);
  for (const touches of [[{ id: 2, x: 320, y: 200 }], [{ id: 2, x: 320, y: 200 }, { id: 3, x: 50, y: 50 }], [{ id: 3, x: 50, y: 50 }, { id: 4, x: 210, y: 200 }]]) {
    const next = moveDrag(drag, touches, current, 16, size);
    expect(next.transform).toEqual(current);
    expect(next.drag.velocity).toEqual({ x: 0, y: 0 });
    drag = next.drag;
  }
  const moved = moveDrag(drag, [{ id: 3, x: 60, y: 50 }, { id: 4, x: 220, y: 200 }], current, 32, size);
  expect(moved.transform.x).toBeCloseTo(35);
});
test('a pure zoom and a pause before release never fling', () => {
  let drag = beginDrag([{ id: 1, x: 150, y: 200 }, { id: 2, x: 250, y: 200 }], IDENTITY, 0);
  const next = moveDrag(drag, [{ id: 1, x: 100, y: 200 }, { id: 2, x: 300, y: 200 }], IDENTITY, 16, size);
  expect(releaseVelocity(next.drag, 17)).toEqual({ x: 0, y: 0 });
  expect(releaseVelocity({ ...next.drag, count: 1, velocity: { x: 700, y: 0 } }, 200)).toEqual({ x: 0, y: 0 });
});
test.each([60, 120])('momentum settles inside the bounds at %i Hz', hz => {
  let state = { transform: { scale: 2, x: 190, y: -210 }, velocity: { x: 1400, y: -800 }, active: true };
  for (let frame = 0; frame < hz * 10 && state.active; frame++) state = momentumStep(state.transform, state.velocity, 1 / hz, size);
  expect(state.active).toBe(false);
  expect(Math.abs(state.transform.x)).toBeLessThanOrEqual(200);
  expect(Math.abs(state.transform.y)).toBeLessThanOrEqual(200);
});

test('grabbing an overscrolled wheel or changing pointers does not apply resistance twice', () => {
  const current = { scale: 2, x: rubber(350, 200), y: rubber(-290, 200) };
  const touches = [{ id: 2, x: 310, y: 220 }];
  const drag = beginDrag(touches, current, 0);
  const next = moveDrag(drag, touches, current, 16, size);
  expect(next.transform.x).toBeCloseTo(current.x);
  expect(next.transform.y).toBeCloseTo(current.y);
  const moved = moveDrag(next.drag, [{ id: 2, x: 311, y: 220 }], next.transform, 32, size);
  expect(moved.transform.x).toBeGreaterThan(current.x);
  expect(moved.transform.x - current.x).toBeLessThan(1);
});
