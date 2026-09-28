import { previewUnit, releasedUnit, resistedOffset } from '../carousel';
test('slow drag previews and commits at half a 100pt interval, including negative halves', () => {
  expect(previewUnit(2, 49, 6)).toBeNull(); expect(previewUnit(2, 50, 6)).toBe(1);
  expect(previewUnit(2, -50, 6)).toBe(3);
  expect(releasedUnit(2, -151, 0, 200, 6)).toBe(4);
  expect(releasedUnit(2, 49, 0, 200, 6)).toBe(2);
});
test('flick uses velocity direction and capped momentum with no wrapping', () => {
  expect(releasedUnit(2, -10, 0, -301, 6)).toBe(3);
  expect(releasedUnit(2, -100, 0, -2000, 6)).toBe(4);
  expect(releasedUnit(2, -100, 0, -10000, 6)).toBe(5);
  expect(releasedUnit(0, 100, 0, 4000, 6)).toBe(0);
  expect(releasedUnit(5, -100, 0, -4000, 6)).toBe(5);
  expect(releasedUnit(2, 10, 100, 4000, 6)).toBe(2);
});
test('rubber band applies only when pulling outwards at an endpoint', () => {
  expect(resistedOffset(0, 100, 6)).toBe(20);
  expect(resistedOffset(5, -100, 6)).toBe(-20);
  expect(resistedOffset(0, -100, 6)).toBe(-100);
  expect(resistedOffset(3, 100, 6)).toBe(100);
  expect(previewUnit(0, 100, 6)).toBeNull();
});
