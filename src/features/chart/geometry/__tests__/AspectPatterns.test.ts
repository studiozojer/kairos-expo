import { findAspectPatterns, PATTERN_NAMES } from '../AspectPatterns';
const points = (degrees: number[]) => degrees.map((longitude, i) => ({ id: String(i), longitude }));
it.each([
  ['Grand Trine', [0, 120, 240]], ['T-square', [0, 90, 180]],
  ['Grand Cross', [0, 90, 180, 270]], ['Yod', [0, 150, 210]],
  ['Kite', [0, 120, 180, 240]], ['Mystic Rectangle', [0, 60, 180, 240]],
] as const)('finds %s once, including across zero Aries', (name, degrees) => {
  expect(findAspectPatterns(points(degrees.map(d => (d + 350) % 360)), [name], 0)).toHaveLength(1);
});
it('requires every edge to fit; does not average away a loose edge', () => {
  expect(findAspectPatterns(points([0, 120, 246]), ['Grand Trine'], 5)).toEqual([]);
  expect(findAspectPatterns(points([0, 120, 245]), ['Grand Trine'], 5)).toHaveLength(1);
});
it('respects type selection, deduplicates placements and rejects invalid tolerance', () => {
  const sky = points([0, 120, 240]);
  expect(findAspectPatterns([...sky, ...sky], PATTERN_NAMES, 5)).toHaveLength(1);
  expect(findAspectPatterns(sky, [], 5)).toEqual([]);
  expect(findAspectPatterns(sky, PATTERN_NAMES, NaN)).toEqual([]);
});
