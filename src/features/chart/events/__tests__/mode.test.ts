import { eventMode, supportsMode } from '../mode';
import { placementFromNode, type Placement } from '../../config/engine-types';
import fixture from '../../fixtures/engine/seattle-2026.json';
import type { EventCapabilities } from '../types';
const body = (name: string, chart = 'moving'): Placement => {
  const p = placementFromNode(fixture.celestial.nodes.find(node => node.body === name)!);
  return { ...p, chartInstanceId: chart, chartName: chart, id: `${chart}:${p.id}` };
};
const sun = body('Sun'), moon = body('Moon'), fixedSun = body('Sun', 'natal');
const capabilities: EventCapabilities = { schema_version: 1, available: true, supported_from: '1900-02-04T00:00:00Z', supported_to: '2199-11-28T00:00:00Z', max_window_days: 31, max_events: 500,
  bodies: ['Sun', 'Moon'], aspects: ['Conjunction', 'Square'], kinds: ['aspect', 'ingress', 'station'], modes: ['moving_moving', 'moving_fixed'], zodiac: 'tropical', reason: 'available' };
test('selection mode follows explicit target, never ring order or another selected chart', () => {
  expect(eventMode([sun, fixedSun], [fixedSun.id], 'moving', ['Square'])).toBeNull();
  const mode = eventMode([sun, fixedSun], [sun.id], 'moving', ['Square'])!;
  expect(mode.kind).toBe('motion');
  expect(mode.query).toMatchObject({ bodies: ['Sun'], kinds: ['ingress', 'station'] });
  expect(eventMode([fixedSun, sun], [sun.id], 'moving', ['Square'])).toEqual(mode);
});
test('same body in different instances becomes moving/fixed, with the fixed longitude in cache identity', () => {
  const mode = eventMode([sun, fixedSun], [sun.id, fixedSun.id], 'moving', ['Square'])!;
  expect(mode.query.bodies).toEqual(['Sun']);
  expect(mode.query.fixed_points).toEqual([{ id: 'fixed', longitude: fixedSun.longitude }]);
  expect(eventMode([{ ...sun, longitude: 2 }, fixedSun], [sun.id, fixedSun.id], 'moving', ['Square'])!.key).toBe(mode.key);
  expect(eventMode([sun, { ...fixedSun, longitude: 2 }], [sun.id, fixedSun.id], 'moving', ['Square'])!.key).not.toBe(mode.key);
  expect(eventMode([sun, fixedSun], [sun.id, fixedSun.id], 'natal', ['Square'])!.query.fixed_points![0].longitude).toBe(sun.longitude);
});
test('within-chart pair requests moving/moving and only enabled supported aspects', () => {
  const mode = eventMode([sun, moon], [sun.id, moon.id], 'moving', ['Square', 'Quincunx'])!;
  expect(mode.query).toMatchObject({ bodies: ['Moon', 'Sun'], aspects: ['Square'], kinds: ['aspect'] });
  expect(mode.query.fixed_points).toBeUndefined();
  expect(eventMode([sun, moon], [sun.id, moon.id], 'moving', ['Quincunx'])).toBeNull();
  expect(eventMode([sun, moon, fixedSun], [sun.id, moon.id, fixedSun.id], 'moving', ['Square'])).toBeNull();
});
test('unsupported moving bodies fail closed; any finite calculated fixed point can be searched', () => {
  const node = { ...sun, id: 'moving:node', bodyName: 'North Node' };
  expect(eventMode([node], [node.id], 'moving', ['Square'])).toBeNull();
  const fixedNode = { ...node, id: 'natal:node', chartInstanceId: 'natal' };
  expect(eventMode([sun, fixedNode], [sun.id, fixedNode.id], 'moving', ['Square'])!.kind).toBe('aspect');
});
test('capability compatibility and supported time bounds gate entry', () => {
  const mode = eventMode([sun, moon], [sun.id, moon.id], 'moving', ['Square'])!;
  const time = Date.parse('2026-09-27T00:00:00Z');
  expect(supportsMode(capabilities, mode, time)).toBe(true);
  for (const cap of [{ ...capabilities, available: false }, { ...capabilities, aspects: [] }, { ...capabilities, modes: [] }, { ...capabilities, zodiac: 'sidereal' }]) expect(supportsMode(cap, mode, time)).toBe(false);
  expect(supportsMode(capabilities, mode, Date.parse(capabilities.supported_to))).toBe(false);
});
