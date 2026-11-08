import React from 'react';
import { act, create } from 'react-test-renderer';
import { buildConfiguration } from '../../config/buildConfiguration';
import fixture from '../../fixtures/engine/seattle-2026.json';
import { bundledPreset } from '../../display/presets';
import { parsePreset, serializePreset } from '../../schema/preset';
import { isAxisAngle } from '../../schema/angle-overlay';
import { useWheelLayout, type WheelLayout } from '../useWheelLayout';
import { layoutAngleLabels, boxesOverlap } from '../../geometry/angleLabels';
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

test('bounded search avoids an obstacle and canvas clipping; impossible placement reports collisions', () => {
  const point = (degree: number, radius: number) => ({ x: 100 + Math.cos(degree * Math.PI / 180) * radius, y: 100 + Math.sin(degree * Math.PI / 180) * radius });
  const input = { id: 'asc', longitude: 0, radius: 90, width: 40, height: 20 };
  const obstacle = { x: 150, y: 90, width: 40, height: 20 };
  const [label] = layoutAngleLabels([input], point, 200, [obstacle], 3);
  expect(label.displaced).toBe(true);
  expect(label.collisions).toBe(0);
  expect(boxesOverlap(label.box, obstacle)).toBe(false);
  expect(label.box.x + label.box.width).toBeLessThanOrEqual(197);
  expect(layoutAngleLabels([input], point, 200, [{ x: 0, y: 0, width: 200, height: 200 }], 3)[0].collisions).toBe(1);
});
