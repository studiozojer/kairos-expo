import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useActiveConfiguration } from '../useActiveConfiguration';
import { nowInstance, type ActiveChart } from '../model';
import type { ActiveCalculation } from '../ActiveChartsContext';
import { DEFAULT_SETTINGS } from '../../settings/chartSettings';
import { bundledPreset } from '../../display/presets';
import fixture from '../../fixtures/engine/seattle-2026.json';

const preset = bundledPreset('classic')!.preset;
const first = nowInstance(DEFAULT_SETTINGS, Date.parse('2026-09-01T00:00:00Z'));
const second = { ...first, id: 'second' };
const ready: ActiveCalculation = { result: { chart: fixture, datetime: fixture.chart_metadata.datetime, settings: DEFAULT_SETTINGS, attempt: 0 }, status: 'ready', retry: jest.fn() };
let output: ReturnType<typeof useActiveConfiguration>;
let view: ReactTestRenderer;
function Probe({ active, calculations }: { active: ActiveChart[]; calculations: Record<string, ActiveCalculation> }) {
  const value = useActiveConfiguration(active, calculations, preset);
  React.useLayoutEffect(() => { output = value; });
  return null;
}
afterEach(() => { if (view) act(() => view.unmount()); });
test('target, unit, requested time and persistence updates keep calculated geometry stable', () => {
  act(() => { view = create(<Probe active={[first]} calculations={{ [first.id]: ready }} />); });
  const config = output.config;
  act(() => { view.update(<Probe active={[{ ...first, unit: 4, time: first.time + 86400000 }]}
    calculations={{ [first.id]: { ...ready, status: 'loading' } }} />); });
  expect(output.config).toBe(config);
  expect(output.previousArrangement).toBe(false);
});
test('pending additions retain complete wheel until ready; empty sessions clear the retained arrangement', () => {
  act(() => { view = create(<Probe active={[first]} calculations={{ [first.id]: ready }} />); });
  const solo = output.config;
  act(() => { view.update(<Probe active={[first, second]} calculations={{ [first.id]: ready }} />); });
  expect(output.config).toBe(solo);
  expect(output.previousArrangement).toBe(true);
  act(() => { view.update(<Probe active={[first, second]} calculations={{ [first.id]: ready, second: ready }} />); });
  expect(output.config?.rings.filter(r => r.type.kind === 'planets')).toHaveLength(2);
  expect(output.previousArrangement).toBe(false);
  act(() => { view.update(<Probe active={[]} calculations={{}} />); });
  expect(output.config).toBeUndefined();
  act(() => { view.update(<Probe active={[second]} calculations={{}} />); });
  expect(output.config).toBeUndefined();
});
