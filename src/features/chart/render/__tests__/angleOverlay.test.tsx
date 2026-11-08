import React from 'react';
import { act, create } from 'react-test-renderer';
import { buildConfiguration, buildMultiConfiguration } from '../../config/buildConfiguration';
import fixture from '../../fixtures/engine/seattle-2026.json';
import { bundledPreset } from '../../display/presets';
import { parsePreset, serializePreset } from '../../schema/preset';
import { isAxisAngle } from '../../schema/angle-overlay';
import { useWheelLayout, type WheelLayout } from '../useWheelLayout';
const preset = bundledPreset('classic')!.preset;

test('optional angle configuration roundtrips, absent presets stay absent', () => {
  expect(parsePreset(serializePreset(preset)).angleOverlay).toBeUndefined();
  const p = { ...preset, angleOverlay: { enabled: true, labels: 'outside' as const } };
  expect(parsePreset(serializePreset(p)).angleOverlay).toEqual(p.angleOverlay);
});

test.each(['inner', 'zodiac', 'outside'] as const)('%s keeps angles for aspects, but removes their glyph layout', labels => {
  const config = buildConfiguration(fixture, { ...preset, angleOverlay: { enabled: true, labels } });
  // Deliberately unrelated house cusps: axes must keep engine longitudes.
  const changed = buildConfiguration({ ...fixture, houses: { ...fixture.houses, nodes: fixture.houses.nodes.map((h, i) => ({ ...h, cusp_longitude: i * 30 })) } }, { ...preset, angleOverlay: { enabled: true, labels } });
  expect(config.angleFrames).toEqual(changed.angleFrames);
  expect(config.angleFrames![0].placements).toHaveLength(4);
  expect(config.aspectEdges).toEqual(buildConfiguration(fixture, preset).aspectEdges);
  expect(config.rings.flatMap(r => r.type.kind === 'planets' ? r.type.placements : []).filter(p => isAxisAngle(p.bodyId))).toHaveLength(4);
  for (const size of [300, 334, 800]) {
    let layout!: WheelLayout;
    function Probe() { layout = useWheelLayout(config, size); return null; }
    let view!: ReturnType<typeof create>;
    act(() => { view = create(<Probe />); });
    expect(layout.feasible).toBe(true);
    expect([...layout.planetLayouts.values()].flat().some(p => isAxisAngle(p.placement.bodyId))).toBe(false);
    act(() => view.unmount());
  }
});

test('multi-chart frames keep qualified identities and missing angles are not invented from cusps', () => {
  const p = { ...preset, angleOverlay: { enabled: true, labels: 'inner' as const } };
  const withoutAngles = { ...fixture, celestial: { ...fixture.celestial, nodes: fixture.celestial.nodes.filter(n => n.node_type !== 'angle') } };
  const config = buildMultiConfiguration([{ instanceId: 'natal', chart: fixture }, { instanceId: 'transit', chart: withoutAngles }], p);
  expect(config.angleFrames![0].chartInstanceId).toBe('natal');
  expect(config.angleFrames![0].placements.every(p => p.chartInstanceId === 'natal')).toBe(true);
  expect(config.angleFrames![1].placements).toEqual([]);
});

test('glyph presentation remains the default when the extension is absent', () => {
  const config = buildConfiguration(fixture, preset);
  let layout!: WheelLayout;
  function Probe() { layout = useWheelLayout(config, 334); return null; }
  let view!: ReturnType<typeof create>;
  act(() => { view = create(<Probe />); });
  expect([...layout.planetLayouts.values()].flat().filter(p => isAxisAngle(p.placement.bodyId))).toHaveLength(4);
  act(() => view.unmount());
});

test('fixed angles keep exact longitude and planets move around their reserved footprint', () => {
  const { fixedAngleMarkers, avoidFixedAngles } = require('../../geometry/fixedAngles');
  const config = buildConfiguration(fixture, { ...preset, angleOverlay: { enabled: true, labels: 'inner' } });
  let layout!: WheelLayout;
  function Probe() { layout = useWheelLayout(config, 400); return null; }
  let view!: ReturnType<typeof create>;
  act(() => { view = create(<Probe />); });
  for (const marker of fixedAngleMarkers(config, layout)) {
    expect(marker.center).toEqual(layout.coordinates.pointForDegree(marker.longitude, marker.inner + 12 * layout.displayScale));
  }
  act(() => view.unmount());
  const point = { x: 100, y: 0 };
  const position = { placement: { id: 'sun', longitude: 0, windowLo: -30, windowHi: 30 }, originalPosition: point, adjustedPosition: point,
    connectionEndpoint: point, farSideConnectionEndpoint: { x: 85, y: 0 }, degreeMarkPosition: { x: 110, y: 0 }, degreeMarkMirrorPosition: { x: 70, y: 0 }, needsConnectionLine: false };
  const obstacle = { x: 80, y: -12, width: 30, height: 24 };
  const result = avoidFixedAngles([position], [obstacle], { x: 0, y: 0 }, 5);
  expect(result.unresolved).toEqual([]);
  expect(result.positions[0].adjustedPosition).not.toEqual(point);
  expect(Math.abs(result.positions[0].adjustedPosition.y)).toBeGreaterThan(17);
  expect(result.positions[0].degreeMarkPosition).toEqual(position.degreeMarkPosition);
  expect(result.positions[0].originalPosition).toEqual(point);
  expect(Math.hypot(result.positions[0].adjustedPosition.x, result.positions[0].adjustedPosition.y)).toBeCloseTo(100);
  const blocked = avoidFixedAngles([{ ...position, placement: { ...position.placement, windowLo: 0, windowHi: 0 } }], [obstacle], { x: 0, y: 0 }, 5);
  expect(blocked.unresolved).toEqual(['sun']);
  expect(blocked.positions[0]).toEqual({ ...position, placement: { ...position.placement, windowLo: 0, windowHi: 0 } });
});
