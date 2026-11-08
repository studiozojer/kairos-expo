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

test.each(['inner', 'zodiac'] as const)('%s annotations inherit independent degree/minute flags and reserve fixed space', labels => {
  const { fixedAngleMarkers } = require('../../geometry/fixedAngles');
  let fixedCenter: { x: number; y: number } | undefined;
  for (const [degrees, minutes] of [[false, false], [true, false], [false, true], [true, true]]) {
    const config = buildConfiguration(fixture, { ...preset, angleOverlay: { enabled: true, labels } });
    config.rings = config.rings.map(r => r.style.$type === 'solar.kairos.preset.ring.style.planets' ? { ...r, style: { ...r.style, showDegreeText: degrees, showMinuteText: minutes } } : r);
    let markers: ReturnType<typeof fixedAngleMarkers>;
    let layout!: WheelLayout;
    function Probe() { layout = useWheelLayout(config, 400); markers = fixedAngleMarkers(config, layout); return null; }
    let view!: ReturnType<typeof create>;
    act(() => { view = create(<Probe />); });
    const marker = markers![0];
    fixedCenter ??= marker.center;
    expect(marker.center).toEqual(fixedCenter);
    expect(marker.annotations).toHaveLength(Number(degrees) + Number(minutes));
    const glyphRadius = Math.hypot(marker.center.x - 200, marker.center.y - 200);
    for (const annotation of marker.annotations) {
      const radius = Math.hypot(annotation.center.x - 200, annotation.center.y - 200);
      if (labels === 'inner') expect(radius).toBeGreaterThan(glyphRadius);
      else expect(radius).toBeLessThan(glyphRadius);
      expect(annotation.center.x).toBeGreaterThanOrEqual(marker.box.x);
      expect(annotation.center.x).toBeLessThanOrEqual(marker.box.x + marker.box.width);
    }
    act(() => view.unmount());
  }
});

test('planet stacks avoid the axis stroke even when clear of its annotation', () => {
  const { avoidFixedAngles, intersectsFixedObstacle } = require('../../geometry/fixedAngles');
  const point = { x: 100, y: -2 };
  const planet = { placement: { id: 'neptune', longitude: 1, windowLo: 0, windowHi: 30 }, originalPosition: point, adjustedPosition: point,
    connectionEndpoint: point, farSideConnectionEndpoint: { x: 80, y: -1.6 }, degreeMarkPosition: { x: 130, y: -2.6 }, degreeMarkMirrorPosition: { x: 60, y: -1.2 }, needsConnectionLine: false };
  const glyph = { x: 45, y: -8, width: 16, height: 16 };
  const stroke = { from: { x: 65, y: 0 }, to: { x: 140, y: 0 }, padding: 2 };
  expect(avoidFixedAngles([planet], [glyph], { x: 0, y: 0 }, 6).positions[0]).toEqual(planet);
  const avoided = avoidFixedAngles([planet], [glyph, stroke], { x: 0, y: 0 }, 6);
  expect(avoided.unresolved).toEqual([]);
  expect(avoided.positions[0].adjustedPosition.y).toBeLessThan(-8);
  expect(avoided.positions[0].degreeMarkPosition).toEqual(planet.degreeMarkPosition);
  // A diagonal line must not block unrelated space inside its large AABB.
  expect(intersectsFixedObstacle({ x: 20, y: 70, width: 8, height: 8 }, { from: { x: 0, y: 0 }, to: { x: 100, y: 100 }, padding: 2 })).toBe(false);
  expect(intersectsFixedObstacle({ x: 45, y: 45, width: 8, height: 8 }, { from: { x: 0, y: 0 }, to: { x: 100, y: 100 }, padding: 2 })).toBe(true);
});

test('axis displacement can push a neighboring group instead of freezing Neptune', () => {
  const { avoidFixedAngles } = require('../../geometry/fixedAngles');
  const planet = (id: string, degree: number) => {
    const p = { x: 100 * Math.cos(degree * Math.PI / 180), y: -100 * Math.sin(degree * Math.PI / 180) };
    return { placement: { id, longitude: degree, windowLo: 0, windowHi: 30 }, originalPosition: p, adjustedPosition: p,
      connectionEndpoint: p, farSideConnectionEndpoint: p, degreeMarkPosition: p, degreeMarkMirrorPosition: p, needsConnectionLine: false };
  };
  const neptune = planet('neptune', 1), neighbor = planet('neighbor', 7);
  const result = avoidFixedAngles([neighbor, neptune], [{ from: { x: 60, y: 0 }, to: { x: 140, y: 0 }, padding: 2 }], { x: 0, y: 0 }, 6);
  expect(result.unresolved).toEqual([]);
  expect(result.positions[1].adjustedPosition.y).toBeLessThan(-8);
  expect(result.positions[0].adjustedPosition.y).toBeLessThan(result.positions[1].adjustedPosition.y - 12);
  expect(result.positions.map((p: { placement: { id: string } }) => p.placement.id)).toEqual(['neighbor', 'neptune']);
});

test('separate diagonal stacks do not repel each other through empty bounding-box corners', () => {
  const { avoidFixedAngles } = require('../../geometry/fixedAngles');
  const planet = (longitude: number) => {
    const point = (radius: number) => ({ x: radius * Math.cos(longitude * Math.PI / 180), y: -radius * Math.sin(longitude * Math.PI / 180) });
    return { placement: { id: String(longitude), longitude, windowLo: 30, windowHi: 60 },
      originalPosition: point(100), adjustedPosition: point(100), connectionEndpoint: point(100),
      farSideConnectionEndpoint: point(50), degreeMarkPosition: point(110), degreeMarkMirrorPosition: point(40), needsConnectionLine: false };
  };
  const positions = [planet(40), planet(55)];
  expect(avoidFixedAngles(positions, [], { x: 0, y: 0 }, 2, { ...require('../../schema/ring-styles').PLANETS_RING_STYLE_DEFAULT, glyphSize: 4, degreeTextFontSize: 2 }).positions).toEqual(positions);
});
