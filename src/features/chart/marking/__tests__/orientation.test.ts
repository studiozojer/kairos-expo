import { rotateOrientation, resetOrientation } from '../../interaction/orientation';
import { CHART_SLOTS } from '../../display/sharedControls';
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

test.each([
  [0, -1, 330], [330, 1, 0], [29.999, 1, 30], [30, -1, 0], [359.999, 1, 0], [-1, 1, 0], [360, -1, 330],
] as const)('rotation from Ascendant %s by %s lands at sign %s', (ascendant, direction, expected) => {
  const preset = bundledPreset('classic')!.preset;
  const next = rotateOrientation(preset, 1, 'ascendant', ascendant, direction);
  for (const slot of CHART_SLOTS) expect(next[slot].globalSettings.staticOrientationDegree).toBe(expected);
  expect(next.aspects).toBe(preset.aspects);
});

test('unlocked rotation references the innermost chart after reorder, independent of stepper selection', () => {
  const preset = bundledPreset('classic')!.preset;
  const a = { instanceId: 'a', chart: withAscendant(25) }, b = { instanceId: 'b', chart: withAscendant(190) };
  const rotated = rotateOrientation(preset, 2, 'ascendant', buildMultiConfiguration([b, a], preset, 'ascendant').orientation, 1);
  expect(buildMultiConfiguration([b, a], rotated, 'static').orientation).toBe(210);
  expect(buildMultiConfiguration([a, b], rotated, 'static').orientation).toBe(210);
  // Unlock resumes astronomical orientation; rotate never writes chart data.
  expect(buildMultiConfiguration([a, b], rotated, 'ascendant').orientation).toBe(25);
});

test('static rotation uses the active preset slot; missing Ascendant falls back to that slot', () => {
  const preset = bundledPreset('classic')!.preset;
  const custom = { ...preset, dualChart: { ...preset.dualChart, globalSettings: { ...preset.dualChart.globalSettings, staticOrientationDegree: 120 } } };
  for (const [mode, angle] of [['static', 25], ['ascendant', undefined], ['ascendant', NaN]] as const) {
    expect(rotateOrientation(custom, 2, mode, angle, -1).dualChart.globalSettings.staticOrientationDegree).toBe(90);
  }
});

test('reset restores each baseline slot and retains unrelated live preset edits', () => {
  const preset = bundledPreset('classic')!.preset;
  const baseline = { ...preset };
  CHART_SLOTS.forEach((slot, i) => { baseline[slot] = { ...preset[slot], globalSettings: { ...preset[slot].globalSettings, staticOrientationDegree: (i + 1) * 30 } }; });
  const edited = { ...rotateOrientation(baseline, 2, 'static', undefined, 1), aspects: { ...preset.aspects, showPatterns: false } };
  const reset = resetOrientation(edited, baseline);
  CHART_SLOTS.forEach((slot, i) => expect(reset[slot].globalSettings.staticOrientationDegree).toBe((i + 1) * 30));
  expect(reset.aspects).toBe(edited.aspects);
  const source = { instanceId: 'a', chart: withAscendant(173) };
  expect(buildMultiConfiguration([source], reset, 'ascendant').orientation).toBe(173);
  expect(buildMultiConfiguration([source], reset, 'static').orientation).toBe(30);
});
