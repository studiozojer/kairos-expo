import { aspectLineWidth } from '../aspectLineWidth';

test('zero weighting preserves the base for all orbs', () => {
  for (const orb of [0, 1, -4, 8]) expect(aspectLineWidth(2, 0, orb, 8)).toBe(2);
});
test('weight blends uniform thickness with squared closeness', () => {
  expect(aspectLineWidth(2, .5, 0, 8)).toBe(2);
  expect(aspectLineWidth(2, .5, 4, 8)).toBe(1.25);
  expect(aspectLineWidth(2, .5, 8, 8)).toBe(1);
  expect(aspectLineWidth(2, 1, 4, 8)).toBe(.5);
  expect(aspectLineWidth(2, 1, -4, 8)).toBe(.5);
});
test('uses the configured tolerance and scales with the base', () => {
  expect(aspectLineWidth(2, 1, 2, 4)).toBe(.5);
  expect(aspectLineWidth(2, 1, 2, 8)).toBe(1.125);
  expect(aspectLineWidth(4, 1, 2, 8)).toBe(2.25);
});
test('full contrast has a visibility floor which never exceeds the base', () => {
  expect(aspectLineWidth(2, 1, 8, 8)).toBe(.15);
  expect(aspectLineWidth(.1, 1, 8, 8)).toBe(.1);
  expect(aspectLineWidth(2, 1, 9, 8)).toBe(.15);
});
test('zero tolerance accepts exactness without NaN and invalid values are bounded', () => {
  expect(aspectLineWidth(2, 1, 0, 0)).toBe(2);
  expect(aspectLineWidth(2, 1, 1, 0)).toBe(.15);
  expect(aspectLineWidth(2, -1, 4, 8)).toBe(2);
  expect(aspectLineWidth(2, 4, 4, 8)).toBe(.15);
  expect(aspectLineWidth(2, NaN, 4, 8)).toBe(2);
  expect(aspectLineWidth(2, 1, NaN, 8)).toBe(2);
});

test('100–300% steepens continuously without increasing exact widths or going negative', () => {
  for (const weighting of [1, 1.5, 2, 3]) {
    expect(aspectLineWidth(2, weighting, 0, 8)).toBe(2);
    expect(aspectLineWidth(2, weighting, 2, 8)).toBeCloseTo(2 * .75 ** (2 * weighting));
    expect(aspectLineWidth(2, weighting, 8, 8)).toBe(.15);
  }
});
