import { buildMultiConfiguration } from '../../config/buildConfiguration';
import chart from '../../fixtures/engine/seattle-2026.json';
import { bundledPreset } from '../../display/presets';

const withAscendant = (longitude: number) => ({ ...chart, celestial: { ...chart.celestial, nodes: chart.celestial.nodes.map(node => node.body_id === 2001 ? { ...node, position: { ...node.position, longitude } } : node) } });
test('unlock follows the innermost chart through reorder, lock restores preset orientation', () => {
  const preset = bundledPreset('classic')!.preset;
  const a = { instanceId: 'a', chart: withAscendant(25) }, b = { instanceId: 'b', chart: withAscendant(190) };
  expect(buildMultiConfiguration([a, b], preset, 'ascendant').orientation).toBe(25);
  expect(buildMultiConfiguration([b, a], preset, 'ascendant').orientation).toBe(190);
  expect(buildMultiConfiguration([a, b], preset, 'static').orientation).toBe(preset.dualChart.globalSettings.staticOrientationDegree);
  expect(buildMultiConfiguration([{ instanceId: 'a', chart: withAscendant(NaN) }], preset, 'ascendant').orientation).toBe(preset.soloChart.globalSettings.staticOrientationDegree);
});
