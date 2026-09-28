import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { SelectionStepper } from '../SelectionStepper';
import { EventStepper } from '../EventStepper';
import { TimeStepper } from '../../time/TimeStepper';
import { useEventAvailability } from '../useEventAvailability';
import { useActiveCharts } from '../../active/ActiveChartsContext';
import { useChartTime } from '../../time/ChartTimeContext';
import { buildMultiConfiguration } from '../../config/buildConfiguration';
import { bundledPreset } from '../../display/presets';
import { nowInstance } from '../../active/model';
import { placementIdentifier } from '../../config/identifiers';
import fixture from '../../fixtures/engine/seattle-2026.json';
import { EVENT_BODIES, EVENT_ASPECTS } from '../types';
jest.mock('../EventStepper', () => ({ EventStepper: jest.fn(() => null) }));
jest.mock('../../time/TimeStepper', () => ({ TimeStepper: jest.fn(() => null) }));
jest.mock('../../time/TimeStepperSurface', () => ({ TimeStepperSurface: ({ children }: any) => children }));
jest.mock('../useEventAvailability');
jest.mock('../../active/ActiveChartsContext');
jest.mock('../../time/ChartTimeContext', () => ({ useChartTime: jest.fn(), ChartTimeProvider: ({ children }: any) => children }));
const first = { ...nowInstance(), id: 'first' }, second = { ...nowInstance(), id: 'second' };
const config = buildMultiConfiguration([{ instanceId: first.id, name: 'One', chart: fixture }, { instanceId: second.id, name: 'Two', chart: fixture }], bundledPreset('classic')!.preset);
const sun = placementIdentifier(first.id, 'sun'), moon = placementIdentifier(second.id, 'moon');
let session: ReturnType<typeof useActiveCharts>, available: ReturnType<typeof useEventAvailability>, view: ReactTestRenderer;
const render = (ids = [sun], enabled = true) => <SelectionStepper config={config} selectedIds={ids} enabled={enabled} active={true} />;
beforeEach(() => {
  session = { active: [first, second], targetId: first.id, loaded: true, calculations: { [first.id]: { status: 'ready' }, [second.id]: { status: 'ready' } }, seek: jest.fn(() => true) } as unknown as typeof session;
  available = { capabilities: { schema_version: 1, available: true, supported_from: '1900-02-04T00:00:00Z', supported_to: '2199-11-28T00:00:00Z', max_window_days: 31, max_events: 500, bodies: [...EVENT_BODIES], aspects: [...EVENT_ASPECTS], kinds: ['aspect', 'ingress', 'station'], modes: ['moving_moving', 'moving_fixed'], zodiac: 'tropical', reason: 'available' }, status: 'available', retry: jest.fn(), reportFailure: jest.fn() };
  jest.mocked(useActiveCharts).mockImplementation(() => session);
  jest.mocked(useEventAvailability).mockImplementation(() => available);
  jest.mocked(useChartTime).mockReturnValue({ targetId: first.id, time: first.time, origin: first.time, settings: first.settings, kind: 'now', reset: jest.fn() } as any);
  act(() => { view = create(render()); });
});
afterEach(() => act(() => view.unmount()));
test('only confirmed compatible readiness enters event mode; failure returns to ordinary time without seeking', () => {
  expect(view.root.findAllByType(EventStepper)).toHaveLength(1);
  available = { ...available, capabilities: null, status: 'checking' };
  act(() => view.update(render()));
  expect(view.root.findAllByType(EventStepper)).toHaveLength(0); expect(view.root.findAllByType(TimeStepper)).toHaveLength(1);
  available.status = 'unavailable'; act(() => view.update(render()));
  expect(session.seek).not.toHaveBeenCalled();
  expect(view.root.findAllByType(TimeStepper)).toHaveLength(1);
});
test('clearing selection returns to time and selecting a supported body restores events', () => {
  act(() => view.update(render([]))); expect(view.root.findAllByType(TimeStepper)).toHaveLength(1);
  act(() => view.update(render([sun]))); expect(view.root.findAllByType(EventStepper)).toHaveLength(1);
});
test('cross-chart query waits for fresh fixed calculation and supplies both snapshots to guarded seek', () => {
  act(() => view.update(render([sun, moon])));
  const event = view.root.findByType(EventStepper);
  expect(event.props.mode.query.fixed_points).toHaveLength(1);
  act(() => event.props.onSeek(first.time + 1000));
  expect(session.seek).toHaveBeenCalledWith({ targetId: first.id, charts: [first, second] }, first.time + 1000);
  session.calculations[second.id].status = 'loading'; act(() => view.update(render([sun, moon])));
  expect(view.root.findAllByType(EventStepper)).toHaveLength(0);
});
test('other-chart selection falls back; temporary disabling retains the disabled event component', () => {
  act(() => view.update(render([moon]))); expect(view.root.findAllByType(EventStepper)).toHaveLength(0);
  act(() => view.update(render([sun], false)));
  const paused = view.root.findByType(EventStepper);
  expect(paused.props.enabled).toBe(false);
  expect(useEventAvailability).toHaveBeenLastCalledWith(true);
  const seek = session.seek; act(() => paused.props.onSeek(first.time + 1000)); expect(seek).not.toHaveBeenCalled();
  act(() => view.update(render([sun], true))); expect(view.root.findByType(EventStepper)).toBe(paused);
});

test('negotiates the enabled aspect subset across old and expanded servers', () => {
  const expanded = { ...config, aspects: { ...config.aspects, enabledTypes: ['Square', 'Semisextile', 'Quincunx'] as typeof config.aspects.enabledTypes } };
  const pair = () => <SelectionStepper config={expanded} selectedIds={[sun, moon]} enabled active />;
  available.capabilities!.aspects = ['Square'];
  act(() => view.update(pair()));
  expect(view.root.findByType(EventStepper).props.mode.query.aspects).toEqual(['Square']);
  available.capabilities!.aspects = ['Square', 'Semisextile', 'Quincunx'];
  act(() => view.update(pair()));
  expect(view.root.findByType(EventStepper).props.mode.query.aspects).toEqual(['Semisextile', 'Square', 'Quincunx']);
  available.capabilities!.aspects = [];
  act(() => view.update(pair()));
  expect(view.root.findAllByType(EventStepper)).toHaveLength(0);
  expect(view.root.findAllByType(TimeStepper)).toHaveLength(1);
});
