import { useLayoutEffect, useState } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { InteractiveChartWheel } from '../InteractiveChartWheel';
import { useChartGesture } from '../useChartGesture';
import { buildConfiguration } from '../../config/buildConfiguration';
import { bundledPreset } from '../../display/presets';
import { toggleBody } from '../../display/displayPreset';
import fixture from '../../fixtures/engine/seattle-2026.json';
jest.mock('../useChartGesture', () => ({ useChartGesture: jest.fn(() => ({ gesture: {}, animatedTransform: {} })) }));
jest.mock('../../render/ChartWheel', () => ({ ChartWheelCanvas: () => null }));
jest.mock('react-native-gesture-handler', () => ({ GestureDetector: ({ children }: any) => children, GestureHandlerRootView: ({ children }: any) => children }));
jest.mock('../../components/ChartSheet', () => ({ ChartSheet: () => null }));
let selection: string[], view: ReactTestRenderer;
const preset = bundledPreset('classic')!.preset;
function Harness({ hideSun = false }) {
  const [ids, setIds] = useState<string[]>([]);
  useLayoutEffect(() => { selection = ids; }, [ids]);
  return <InteractiveChartWheel config={buildConfiguration(fixture, hideSun ? toggleBody(preset, 'Sun', false) : preset)} size={300}
    viewport={{ width: 400, height: 700 }} baseCenter={{ x: 200, y: 350 }} selectionStyle={preset.selection}
    selectedIds={ids} onSelectionChange={setIds} onHideBody={() => {}} />;
}
afterEach(() => act(() => view.unmount()));
test('wheel publishes stable selected identities, accumulates batched taps, and clears hidden bodies', () => {
  act(() => { view = create(<Harness />); });
  const tap = jest.mocked(useChartGesture).mock.calls.at(-1)![3];
  act(() => { tap('sun'); tap('moon'); });
  expect(selection).toEqual(['sun', 'moon']);
  act(() => view.update(<Harness />)); expect(selection).toEqual(['sun', 'moon']);
  act(() => view.update(<Harness hideSun />)); expect(selection).toEqual(['moon']);
});
