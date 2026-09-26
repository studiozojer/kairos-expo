import { findAspectPatterns, PATTERN_NAMES } from '../AspectPatterns';
const points = (degrees: number[]) => degrees.map((longitude, i) => ({ id: String(i), longitude }));
it.each([
  ['Grand Trine', [0, 120, 240]], ['T-square', [0, 90, 180]],
  ['Grand Cross', [0, 90, 180, 270]], ['Yod', [0, 150, 210]],
  ['Kite', [0, 120, 180, 240]], ['Mystic Rectangle', [0, 60, 180, 240]],
] as const)('finds %s once, including across zero Aries', (name, degrees) => {
  const found = findAspectPatterns(points(degrees.map(d => (d + 350) % 360)), [name], 0);
  expect(found).toHaveLength(1);
  expect(found[0].maxOrb).toBe(0);
  const loose = points(degrees.map((d, i) => d + (i === 0 ? 2 : 0)));
  expect(findAspectPatterns(loose, [name], 4)[0].maxOrb).toBe(2);
  expect(findAspectPatterns([...loose].reverse(), [name], 4)[0].maxOrb).toBe(2);
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

it('reports the widest pair, including diagonals, across chart-qualified bodies', () => {
  const sky = [0, 92, 184, 272].map((longitude, i) => ({ id: `${i % 2}:body-${i}`, longitude }));
  const patterns = findAspectPatterns(sky, ['Grand Cross'], 5);
  expect(patterns).toHaveLength(1);
  expect(patterns[0].maxOrb).toBe(4);
  expect(patterns[0].points.map(p => p.id).sort()).toEqual(sky.map(p => p.id).sort());
  expect(findAspectPatterns(sky, ['Grand Cross'], 3)).toEqual([]);
});

it('treats floating-point noise in an exact rotated pattern as zero orb', () => {
  const pattern = findAspectPatterns(points([.123, 120.123, 240.123]), ['Grand Trine'], 0)[0];
  expect(pattern.maxOrb).toBe(0);
});
