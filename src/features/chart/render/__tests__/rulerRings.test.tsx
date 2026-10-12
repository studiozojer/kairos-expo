import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Text as SkiaText } from '@shopify/react-native-skia';
import { ChartWheel } from '../ChartWheel';
import { useWheelLayout } from '../useWheelLayout';
import { chartTargets, selectionPaint } from '../../interaction/selection';
import { buildMultiConfiguration } from '../../config/buildConfiguration';
import { displayTemplate } from '../../display/templates';
import { createRing, renderingPreset } from '../../display/model';
import chart from '../../fixtures/engine/seattle-2026.json';
import type { ChartCalculationResponse } from '../../config/engine-types';
jest.mock('expo-crypto', () => { let n = 200; return { randomUUID: () => `00000000-0000-4000-8000-${String(++n).padStart(12,'0')}` }; });
function config(kind: 'signRulers' | 'decans' | 'terms') {
  const preset = displayTemplate('classic')!; const ring = createRing(kind);
  preset.layouts[1].rings.unshift(ring);
  return { preset, ring, config: buildMultiConfiguration([{ instanceId:'inner', chart:chart as ChartCalculationResponse }],renderingPreset(preset)) };
}
test.each([['signRulers',12],['decans',36],['terms',60]] as const)('%s renders every ruler with one fitted size', (kind,count) => {
  const { config: value } = config(kind); let tree!: TestRenderer.ReactTestRenderer;
  act(()=>{tree=TestRenderer.create(<ChartWheel config={value} size={400} />);});
  const glyphs = tree.root.findAll(node => typeof node.props.name === 'string' && node.props.name.startsWith('celestials/')).slice(0,count);
  expect(glyphs).toHaveLength(count); expect(new Set(glyphs.map(glyph=>glyph.props.size)).size).toBe(1);
  expect(glyphs.every(glyph=>glyph.props.size > 0)).toBe(true);
  expect(glyphs[0].props.name).toBe(`celestials/${kind === 'terms' ? 'jupiter' : 'mars'}`);
  act(()=>tree.unmount());
});
test('segment selection finds rulers; planet selection keeps relationships in its chart', () => {
  const { preset, config: value } = config('signRulers');
  let targets: ReturnType<typeof chartTargets> = [];
  function Probe() { targets = chartTargets(useWheelLayout(value,400)); return null; }
  let tree!: TestRenderer.ReactTestRenderer; act(()=>{tree=TestRenderer.create(<Probe />);});
  const segment = targets.find(target=>target.kind==='segment' && target.ruler==='mars')!;
  const mars = targets.find(target=>target.placement?.bodyId==='mars')!;
  const paint = selectionPaint([segment.id],targets,value,{...renderingPreset(preset).selection,includeRulershipPlanets:true});
  expect(paint.related.has(mars.id)).toBe(true);
  const other = {...mars,id:'other:mars',placement:{...mars.placement!,chartInstanceId:'other'}};
  const planet = targets.find(target=>target.placement)!;
  const fromPlanet = selectionPaint([planet.id],[...targets,other],value,{...renderingPreset(preset).selection,includeRulershipPlanets:true});
  expect(fromPlanet.related.has(other.id)).toBe(false);
  act(()=>tree.unmount());
});
test('impossible layouts show an explanation and do not draw a canvas', () => {
  const { config:value } = config('terms'); value.rings.forEach(ring=>{ring.thickness={kind:'fixed',value:150};});
  let tree!: TestRenderer.ReactTestRenderer; act(()=>{tree=TestRenderer.create(<ChartWheel config={value} size={100} />);});
  expect(tree.root.findAll(node => typeof node.props.name === 'string' && node.props.name.startsWith('celestials/'))).toHaveLength(0);
  expect(JSON.stringify(tree.toJSON())).toContain('This layout needs more room');
  act(()=>tree.unmount());
});
test('cusp content flags reach the drawing tree', () => {
  const preset=displayTemplate('classic')!; const cusp=createRing('cuspAnnotations');
  if(cusp.kind !== 'cuspAnnotations') throw new Error();
  cusp.options={showSignGlyph:false,showDegrees:false,showMinutes:false};
  preset.layouts[1].rings=[cusp,...preset.layouts[1].rings.filter(ring=>ring.kind==='planets')];
  const value=buildMultiConfiguration([{instanceId:'inner',chart:chart as ChartCalculationResponse}],renderingPreset(preset));
  let tree!: TestRenderer.ReactTestRenderer;act(()=>{tree=TestRenderer.create(<ChartWheel config={value} size={400} />);});
  expect(tree.root.findAllByType(SkiaText).some(node=>node.props.text?.includes("'"))).toBe(false);
  act(()=>tree.unmount());
});
