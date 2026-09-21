import React from 'react';
import { themeFor } from '@/theme';
import { ChartPaintProvider } from '../../render/colors';
import { act, create } from 'react-test-renderer';
import fixture from '../../fixtures/engine/seattle-2026.json';
import { bundledPreset } from '../../display/presets';
import { buildConfiguration, buildMultiConfiguration, type RenderChart } from '../buildConfiguration';
import type { ChartRenderingConfiguration, RingConfiguration } from '../ChartRenderingConfiguration';
import type { ChartCalculationResponse } from '../engine-types';
import { placementIdentifier, houseIdentifier } from '../identifiers';
import { useWheelLayout, type WheelLayout } from '../../render/useWheelLayout';
import { chartTargets, selectionPaint, cuspSelectionOpacity } from '../../interaction/selection';
import { AspectOverlay } from '../../render/AspectOverlay';
import { PatternOverlay } from '../../render/PatternOverlay';
import { findAspectPatterns } from '../../geometry/AspectPatterns';

const preset = bundledPreset('classic')!.preset;
const source = (instanceId: string, chart: ChartCalculationResponse = fixture): RenderChart => ({ instanceId, chart, name: instanceId });
const planets = (config: ChartRenderingConfiguration) => config.rings.filter((r): r is RingConfiguration & {type: Extract<RingConfiguration['type'], {kind: 'planets'}>} => r.type.kind === 'planets');
function oneSun(degree: number): ChartCalculationResponse {
  const sun = fixture.celestial.nodes.find(n => n.id === 'sun')!;
  return { ...fixture, celestial: { nodes: [{ ...sun, sign_placement: ['Aries', 'Leo', 'Sagittarius'][degree / 120] ?? 'Aries', position: { ...sun.position, longitude: degree } }], edges: [] } };
}
const three = [source('natal', oneSun(0)), source('transits', oneSun(120)), source('third', oneSun(240))];

function layoutFor(config: ChartRenderingConfiguration) {
  let result!: WheelLayout;
  function Probe() { result = useWheelLayout(config, 400); return null; }
  let view!: ReturnType<typeof create>;
  act(() => { view = create(<Probe />); });
  act(() => view.unmount());
  return result;
}

test('selects existing slots, maps charts inside-out, and preserves solo preview IDs', () => {
  for (const count of [1, 2, 3]) {
    const config = buildMultiConfiguration(three.slice(0, count), preset);
    const slot = count === 3 ? preset.tripleChart : count === 2 ? preset.dualChart : preset.soloChart;
    expect(config.globalSettings).toEqual(slot.globalSettings);
    expect(planets(config).map(r => r.chartInstanceId)).toEqual(three.slice(0, count).map(c => c.instanceId).reverse());
    expect(planets(config).map(r => r.type.ringNumber)).toEqual(Array.from({ length: count }, (_, i) => count - i));
    expect(planets(config).every(r => r.type.maxRingNumber === count)).toBe(true);
  }
  expect(planets(buildConfiguration(fixture, preset))[0].type.placements[0].id).not.toContain('[');
  expect(() => buildMultiConfiguration([...three, source('fourth')], preset)).toThrow('three');
  expect(() => buildMultiConfiguration([three[0], three[0]], preset)).toThrow('unique');
});

test('same bodies have independent stable IDs, chart labels, and geometry across reordering', () => {
  const config = buildMultiConfiguration([source('natal'), source('transits')], preset);
  const layout = layoutFor(config);
  const targets = chartTargets(layout);
  const suns = targets.filter(t => t.placement?.bodyId === 'sun');
  expect(suns).toHaveLength(2);
  expect(new Set(suns.map(t => t.id)).size).toBe(2);
  expect(suns.map(t => t.detail)).toEqual(expect.arrayContaining([expect.stringContaining('natal'), expect.stringContaining('transits')]));
  expect(suns[0].x === suns[1].x && suns[0].y === suns[1].y).toBe(false);
  const selected = [placementIdentifier('natal', 'sun')];
  const reordered = buildMultiConfiguration([source('transits'), source('natal')], preset);
  const reorderedTargets = chartTargets(layoutFor(reordered));
  const paint = selectionPaint(selected, reorderedTargets, reordered, { ...preset.selection, includeAspectedPlanets: false });
  expect([...paint.selectedBodies]).toEqual(selected);
  expect(paint.selected.has(placementIdentifier('transits', 'sun'))).toBe(false);
  expect(paint.related.has(houseIdentifier('natal', suns.find(s => s.placement?.chartInstanceId === 'natal')!.placement!.housePlacement))).toBe(true);
});

test('uses each chart house frame for windows/cusps and the innermost chart for shared houses', () => {
  const shifted = { ...fixture, houses: { ...fixture.houses, nodes: fixture.houses.nodes.map(h => ({ ...h, cusp_longitude: (h.cusp_longitude + 35) % 360 })) } };
  const config = buildMultiConfiguration([source('natal'), source('other', shifted)], preset);
  const rings = planets(config);
  expect(rings[0].houseCusps).toEqual(shifted.houses.nodes.map(h => h.cusp_longitude));
  expect(rings[1].houseCusps).toEqual(fixture.houses.nodes.map(h => h.cusp_longitude));
  for (const ring of rings) for (const p of ring.type.placements.filter(p => p.housePlacement)) {
    expect(p.windowLo).toBe(ring.houseCusps![p.housePlacement - 1]);
  }
  expect(config.houseCusps).toEqual(rings[1].houseCusps);
  expect(config.referenceInstanceId).toBe('natal');
  expect(config.rings.find(r => r.type.kind === 'houseNumbers')!.chartInstanceId).toBe('natal');
  const targets = chartTargets(layoutFor(config));
  const paint = selectionPaint([houseIdentifier('natal', 1)], targets, config, { ...preset.selection, relatedOpacity: .7, unselectedOpacity: .2 });
  expect(cuspSelectionOpacity(paint, 0, 'natal')).toBe(.7);
  expect(cuspSelectionOpacity(paint, 0, 'other')).toBe(.2);
});

test('calculates all three cross-chart pairs including repeated Suns and namespaced engine edges', () => {
  const config = buildMultiConfiguration(three, preset);
  expect(config.aspectEdges).toHaveLength(3);
  const pair = (a: string, b: string) => [a, b].sort().join('|');
  expect(config.aspectEdges.map(e => pair(e.from, e.to)).sort()).toEqual([
    pair(placementIdentifier('natal', 'sun'), placementIdentifier('transits', 'sun')),
    pair(placementIdentifier('natal', 'sun'), placementIdentifier('third', 'sun')),
    pair(placementIdentifier('transits', 'sun'), placementIdentifier('third', 'sun')),
  ].sort());
  const normal = buildMultiConfiguration([source('natal')], preset);
  expect(normal.aspectEdges[0]).toEqual({ ...fixture.celestial.edges[0], from: placementIdentifier('natal', fixture.celestial.edges[0].from), to: placementIdentifier('natal', fixture.celestial.edges[0].to) });
});

test('patterns retain all three same-body identities, surviving reorder with complete selection', () => {
  const config = buildMultiConfiguration(three, preset);
  const points = planets(config).flatMap(r => r.type.placements);
  const found = findAspectPatterns(points, ['Grand Trine'], 1);
  expect(found).toHaveLength(1);
  expect(new Set(found[0].points.map(p => p.id)).size).toBe(3);
  const reordered = buildMultiConfiguration([...three].reverse(), preset);
  expect(findAspectPatterns(planets(reordered).flatMap(r => r.type.placements), ['Grand Trine'], 1)[0].points.map(p => p.id).sort()).toEqual(found[0].points.map(p => p.id).sort());
});

test('overlay uses real ring membership and exact chart selections; patterns require all qualified members', () => {
  const config = buildMultiConfiguration(three, preset);
  config.aspects = { ...config.aspects, enabled: true, interAspectsOnly: true, filterBySelection: true, mutualAspectsOnly: true, showFalseAspects: true, showSeparatingAspects: true, showPatterns: true, patterns: { enabledTypes: ['Grand Trine'], orb: 1 } };
  const layout = layoutFor(config);
  function Probe({ selected, patterns = false }: { selected: string[]; patterns?: boolean }) {
    return <ChartPaintProvider value={themeFor("dark")}>{patterns ? <PatternOverlay config={config} layout={layout} selectedIdentifiers={new Set(selected)} /> : <AspectOverlay config={config} layout={layout} selectedIdentifiers={new Set(selected)} />}</ChartPaintProvider>;
  }
  let view!: ReturnType<typeof create>;
  act(() => { view = create(<Probe selected={[]} />); });
  const paths = () => view.root.findAll(n => (n.type as unknown) === 'skPath');
  expect(paths()).toHaveLength(3);
  const ids = three.map(c => placementIdentifier(c.instanceId, 'sun'));
  act(() => view.update(<Probe selected={[ids[0]]} />));
  expect(paths()).toHaveLength(2);
  act(() => view.update(<Probe selected={ids.slice(0, 2)} />));
  expect(paths()).toHaveLength(1);
  act(() => view.update(<Probe selected={ids.slice(0, 2)} patterns />));
  expect(paths()).toHaveLength(0);
  act(() => view.update(<Probe selected={ids} patterns />));
  expect(paths()).toHaveLength(1);
  act(() => view.unmount());
});


test.each([0, 1])('disabling dual planet slot %i hides its own chart without remapping the other', disabledSlot => {
  let slot = 0;
  const changed = { ...preset, dualChart: { ...preset.dualChart, rings: preset.dualChart.rings.map(r => {
    if (r.type !== 'planets') return r;
    return { ...r, enabled: slot++ !== disabledSlot };
  }) } };
  const config = buildMultiConfiguration([source('inner'), source('outer')], changed);
  expect(planets(config)).toHaveLength(1);
  expect(planets(config)[0].chartInstanceId).toBe(disabledSlot === 0 ? 'inner' : 'outer');
  expect(planets(config)[0].type.ringNumber).toBe(disabledSlot === 0 ? 1 : 2);
  expect(config.chartCount).toBe(2);
});
