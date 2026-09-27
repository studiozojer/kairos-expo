import { wheelFrame } from '../wheelFrame';

test('fits the wheel and control strip inside a short portrait area', () => {
  const frame = wheelFrame(390, { y: 240, height: 360 }, false);
  expect(frame).toEqual({ size: 300, center: { x: 195, y: 398 } });
  expect(frame.center.y - frame.size / 2).toBe(248);
  expect(frame.center.y + frame.size / 2 + 44).toBe(592);
});
test('a parent resize updates size and position together, without a child-layout callback', () => {
  const expanded = wheelFrame(390, { y: 240, height: 360 }, false);
  const collapsed = wheelFrame(390, { y: 120, height: 480 }, false);
  expect(collapsed).toEqual({ size: 390, center: { x: 195, y: 338 } });
  expect(wheelFrame(390, { y: 240, height: 360 }, false)).toEqual(expanded);
});
test('error retry has a fixed 44pt slot and zero space never yields a negative wheel', () => {
  const frame = wheelFrame(390, { y: 240, height: 360 }, true);
  expect(frame).toEqual({ size: 256, center: { x: 195, y: 376 } });
  expect(frame.center.y + frame.size / 2 + 88).toBe(592);
  expect(wheelFrame(390, { y: 240, height: 0 }, false).size).toBe(0);
});
