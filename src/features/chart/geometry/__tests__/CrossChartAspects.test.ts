import { calculateCrossChartAspects } from '../CrossChartAspects';
import { placementFromNode } from '../../config/engine-types';
import fixture from '../../fixtures/engine/seattle-2026.json';
import { parseAspectConfiguration } from '../../schema/preset';

const sun = placementFromNode(fixture.celestial.nodes.find(n => n.id === 'sun')!);
const from = { ...sun, id: 'instance-a-sun', longitude: 359, speedLongitude: 1 };
const to = { ...sun, id: 'instance-b-sun', longitude: 1, speedLongitude: 0 };
const config = parseAspectConfiguration({ enabledTypes: ['Conjunction'], orbs: { orbs: { Conjunction: 4 } } });

test('wraps longitude and preserves same-body cross-chart conjunctions with finite strength', () => {
  const result = calculateCrossChartAspects([from], [to], config);
  expect(result).toEqual([{ from: from.id, to: to.id, aspect_type: 'Conjunction', orb: -2, strength: .5, is_applying: true }]);
  expect(calculateCrossChartAspects([{ ...from, speedLongitude: -1 }], [to], config)[0].is_applying).toBe(false);
});

test('zero orb permits only exact aspects without dividing strength by zero', () => {
  const exact = { ...config, orbs: { orbs: { Conjunction: 0 } } };
  expect(calculateCrossChartAspects([from], [to], exact)).toEqual([]);
  const result = calculateCrossChartAspects([{ ...from, longitude: 1 }], [to], exact);
  expect(result).toHaveLength(1);
  expect(result[0].strength).toBe(1);
  expect(Number.isFinite(result[0].orb)).toBe(true);
});

test('does not suppress complementary points across different chart frames', () => {
  const opposition = { ...config, enabledTypes: ['Opposition'], orbs: { orbs: { Opposition: 3 } } };
  expect(calculateCrossChartAspects([{ ...from, bodyId: 'ascendant', longitude: 0 }], [{ ...to, bodyId: 'descendant', longitude: 180 }], opposition)).toHaveLength(1);
});
