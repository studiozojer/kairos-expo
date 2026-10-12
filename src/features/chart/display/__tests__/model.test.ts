import { displayTemplate, TEMPLATE_NAMES } from '../templates';
import { copyPreset, createRing, editRing, moveRing, renderingPreset } from '../model';
import { validateDisplayPreset } from '../validation';
import { buildMultiConfiguration } from '../../config/buildConfiguration';
import chart from '../../fixtures/engine/seattle-2026.json';
import type { ChartCalculationResponse } from '../../config/engine-types';
jest.mock('expo-crypto', () => { let n = 0; return { randomUUID: () => `00000000-0000-4000-8000-${String(++n).padStart(12,'0')}` }; });
test.each(TEMPLATE_NAMES)('%s is a complete local document', name => { expect(() => validateDisplayPreset(displayTemplate(name))).not.toThrow(); });
test('invalid dimensions, source slots and style variants cannot enter rendering', () => {
  const preset = displayTemplate('classic')!;
  const zodiac = preset.layouts[1].rings.find(ring => ring.kind === 'zodiac')!;
  expect(() => validateDisplayPreset(editRing(preset,1,zodiac.id,ring => ({...ring,style:{...ring.style,minorMarkInterval:0}} as typeof ring)))).toThrow();
  const malformed = JSON.parse(JSON.stringify(preset)); malformed.layouts[1].rings[0].kind = 'future';
  expect(() => validateDisplayPreset(malformed)).toThrow();
  const planets = preset.layouts[1].rings.find(ring => ring.kind === 'planets')!;
  expect(() => validateDisplayPreset(editRing(preset,1,planets.id,ring => ({...ring,sourceSlot:3} as typeof ring)))).toThrow();
});
test('reordering and hiding rings preserve explicit chart sources', () => {
  const preset = displayTemplate('classic')!;
  const charts = [{instanceId:'first',chart:chart as ChartCalculationResponse},{instanceId:'second',chart:chart as ChartCalculationResponse}];
  const planets = preset.layouts[2].rings.filter(ring => ring.kind === 'planets');
  const owner = (p: typeof preset) => Object.fromEntries(buildMultiConfiguration(charts,renderingPreset(p)).rings.filter(ring => ring.type.kind === 'planets').map(ring=>[ring.id,ring.chartInstanceId]));
  const before = owner(preset);
  const moved = moveRing(preset,2,planets[0].id,1);
  expect(owner(moved)).toEqual(before);
  const hidden = editRing(moved,2,planets[0].id,ring=>({...ring,enabled:false}));
  expect(owner(hidden)[planets[1].id]).toBe(before[planets[1].id]);
});
test('duplicate regenerates all identities and supports terms', () => {
  const preset = displayTemplate('classic')!;
  preset.layouts[1].rings.unshift(createRing('terms'));
  validateDisplayPreset(preset);
  const copy = copyPreset(preset);
  expect(copy.id).not.toBe(preset.id);
  expect(copy.layouts[1].rings.every(ring=>!preset.layouts[1].rings.some(old=>old.id===ring.id))).toBe(true);
  const config = buildMultiConfiguration([{instanceId:'first',chart:chart as ChartCalculationResponse}],renderingPreset(copy));
  expect(config.rings.find(ring=>ring.type.kind==='rulerSegments')?.type).toMatchObject({segments:expect.any(Array),system:'egyptian'});
});
// These assertions are checked by tsc; Babel/Jest cannot establish type safety.
function invalidVariants(ring: Extract<import('../model').DisplayRing, { kind: 'terms' }>) {
  // @ts-expect-error Modern sign rulership is not a term system.
  ring.options.system = 'modern';
  // @ts-expect-error Shared term rings cannot own a chart source slot.
  ring.sourceSlot = 1;
  // @ts-expect-error House number styling cannot be assigned to terms.
  ring.style.numberFontSize = 12;
}
void invalidVariants;
