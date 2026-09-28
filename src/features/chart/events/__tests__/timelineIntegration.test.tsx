import { useState } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { EventStepper } from '../EventStepper';
import { EventTimeline } from '../EventTimeline';
import { fetchEventWindow } from '../api';
import { bundledPreset } from '../../display/presets';
import type { EventCapabilities, EventMode, SkyEvent } from '../types';
jest.mock('../api', () => ({ fetchEventWindow: jest.fn() }));
jest.mock('../EventTimeline', () => ({ EventTimeline: jest.fn(() => null) }));
jest.mock('../../time/TimeStepButton', () => ({ TimeStepButton: 'TimeStepButton' }));
jest.mock('../../time/stepperHaptics', () => ({ stepperHaptic: jest.fn() }));
jest.mock('../../components/ChartSheet', () => ({ ChartSheet: ({ visible, children }: any) => visible ? children : null, SheetHeader: 'SheetHeader' }));
jest.mock('react-native-gesture-handler', () => ({ ...jest.requireActual('react-native-gesture-handler'), GestureDetector: 'GestureDetector' }));
const DAY = 86400000, now = Date.parse('2026-09-01T00:00:00Z');
const preset = bundledPreset('classic')!.preset;
const cap: EventCapabilities = { schema_version: 1, available: true, supported_from: new Date(now - 20 * DAY).toISOString(), supported_to: new Date(now + 20 * DAY).toISOString(), max_window_days: 31, max_events: 500, bodies: ['Mercury'], aspects: [], kinds: ['ingress', 'station'], modes: ['moving_moving'], zodiac: 'tropical', reason: 'available' };
const mode: EventMode = { key: 'mercury', kind: 'motion', label: 'Mercury', query: { zodiac: 'tropical', bodies: ['Mercury'], aspects: [], kinds: ['station', 'ingress'] } };
const events: SkyEvent[] = [-2, -1, 1, 2, 3].map(days => ({ kind: 'station', body: 'Mercury', time: new Date(now + days * DAY).toISOString(), direction: days % 2 ? 'direct' : 'retrograde' }));
const seek = jest.fn(), unavailable = jest.fn();
let view: ReactTestRenderer;
function Harness({ enabled = true }: { enabled?: boolean }) {
  const [time, setTime] = useState(now);
  return <EventStepper mode={mode} capabilities={cap} time={time} origin={now - 3 * DAY} kind="saved" enabled={enabled}
    colors={preset.colors} aspectHues={preset.aspectOverlay.aspectHues} timezone="UTC" onSeek={next => { seek(next); setTime(next); return true; }}
    onReset={() => setTime(now - 3 * DAY)} onUnavailable={unavailable} />;
}
const timeline = () => view.root.findByType(EventTimeline).props;
const action = async (name: string) => { await act(async () => view.root.findAll(n => n.props.testID === 'event-timeline')[0].props.onAccessibilityAction({ nativeEvent: { actionName: name } })); };
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(fetchEventWindow).mockImplementation(async (query, from, to) => ({ schema_version: 1, coverage_complete: true,
    from: new Date(from).toISOString(), to: new Date(to).toISOString(), events: events.filter(e => Date.parse(e.time) >= from && Date.parse(e.time) < to && query.kinds.includes(e.kind)) }));
});
afterEach(() => act(() => view.unmount()));
test('prefetches real neighbors without moving time; cached forward and reversal include entry marker', async () => {
  await act(async () => { view = create(<Harness />); });
  expect(seek).not.toHaveBeenCalled();
  expect(timeline().slots.map((n: any) => n?.time)).toEqual([-2, -1, 0, 1, 2].map(d => now + d * DAY));
  expect(timeline().slots[2].kind).toBe('entry');
  const requests = jest.mocked(fetchEventWindow).mock.calls.length;
  const originalWindows = new Set(jest.mocked(fetchEventWindow).mock.calls.map(call => `${call[1]}:${call[2]}`));
  await action('increment');
  expect(seek).toHaveBeenLastCalledWith(now + DAY); expect(timeline().slots[2].event.kind).toBe('station');
  expect(timeline().transition.direction).toBe(1);
  await action('increment'); expect(seek).toHaveBeenLastCalledWith(now + 2 * DAY);
  await action('decrement'); expect(seek).toHaveBeenLastCalledWith(now + DAY);
  expect(timeline().transition.direction).toBe(-1);
  await action('decrement'); expect(seek).toHaveBeenLastCalledWith(now);
  expect(timeline().slots[2].kind).toBe('entry');
  // Stepping can prefetch farther ahead, but must not refetch covered windows.
  for (const call of jest.mocked(fetchEventWindow).mock.calls.slice(requests)) expect(originalWindows.has(`${call[1]}:${call[2]}`)).toBe(false);
});
test('reset goes to saved origin without animated travel and removes the entry waypoint', async () => {
  await act(async () => { view = create(<Harness />); });
  await action('increment'); await action('reset');
  expect(timeline().transition.direction).toBe(0);
  expect(timeline().slots[2].kind).toBe('origin');
  expect(timeline().slots.filter(Boolean).every((node: any) => node.kind !== 'entry')).toBe(true);
});
test('disabled context aborts speculative windows and rejects their late results', async () => {
  const pending: (() => void)[] = [];
  jest.mocked(fetchEventWindow).mockImplementation((query, from, to) => new Promise(resolve => pending.push(() => resolve({ schema_version: 1, coverage_complete: true, from: new Date(from).toISOString(), to: new Date(to).toISOString(), events: events.filter(e => Date.parse(e.time) >= from && Date.parse(e.time) < to) }))));
  await act(async () => { view = create(<Harness />); });
  const signals = jest.mocked(fetchEventWindow).mock.calls.map(call => call[3]);
  act(() => view.update(<Harness enabled={false} />));
  expect(signals.every(signal => signal.aborted)).toBe(true);
  await act(async () => pending.forEach(resolve => resolve()));
  expect(timeline().slots.filter(Boolean).every((node: any) => node.kind !== 'event')).toBe(true);
  expect(seek).not.toHaveBeenCalled(); expect(unavailable).not.toHaveBeenCalled();
});
test('previews cannot turn a network failure into empty successful coverage', async () => {
  jest.mocked(fetchEventWindow).mockRejectedValue(new Error('offline'));
  await act(async () => { view = create(<Harness />); });
  expect(unavailable).toHaveBeenCalled(); expect(seek).not.toHaveBeenCalled();
});
