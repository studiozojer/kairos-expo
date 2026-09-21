import { useEffect, useLayoutEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AppState } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import { cardSlotAt, slotCardWidth } from '../cardSlots';
import { useCardDrag } from '../useCardDrag';
import { useCardDragSession } from '../useCardDragSession';
import { cardHaptic } from '../cardHaptics';
import { isPutAwayPoint, putAwayCenter, resolveCardDrop } from '../cardDrop';

jest.mock('../cardHaptics', () => ({ cardHaptic: jest.fn() }));
let mockQueue: (() => void)[] | null = null;
jest.mock('react-native-reanimated', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    useReducedMotion: () => false, ReduceMotion: { Always: 'always', Never: 'never' },
    useSharedValue: (initial: unknown) => React.useRef({ value: initial }).current,
    useAnimatedReaction: () => {},
    runOnJS: (fn: (...args: any[]) => void) => (...args: any[]) => mockQueue ? mockQueue.push(() => fn(...args)) : fn(...args), cancelAnimation: () => {}, withSpring: (value: number) => value,
  };
});
let session: ReturnType<typeof useCardDragSession>;
let dragging: typeof session.dragging, target: typeof session.target;
const onDrop = jest.fn();
let drag: ReturnType<typeof useCardDrag>, view: ReactTestRenderer;
function Probe({ width = 320, ids = ['a', 'b', 'c'], index = 0, enabled = true }: { width?: number; ids?: string[]; index?: number; enabled?: boolean }) {
  const controller = useCardDragSession({ ids, viewport: { x: 10, y: 20, width: width + 60, height: 760 }, enabled,
    onDrop: drop => drop.kind === 'reorder' ? onDrop(drop.id, drop.targetId) : onDrop(drop.id) });
  const { invalidate } = controller;
  useLayoutEffect(() => { invalidate(); }, [width, invalidate]);
  const result = useCardDrag({ id: ids[index], index, ids, width, height: 100, gap: 8, session: controller });
  useEffect(() => { session = controller; dragging = controller.dragging; target = controller.target; });
  useEffect(() => { drag = result; });
  return null;
}
const event = (absoluteX: number, absoluteY = 150) => ({ absoluteX, absoluteY, x: 20, y: 50,
  translationX: absoluteX - 40, translationY: absoluteY - 150 }) as never;
const handlers = () => (drag.gesture as ReturnType<typeof Gesture.Pan>).handlers;
function begin() {
  act(() => { handlers().onBegin!(event(40)); handlers().onStart!(event(40)); });
}
beforeEach(() => {
  jest.clearAllMocks(); mockQueue = null;
  act(() => { view = create(<Probe />); });
});
afterEach(() => { act(() => view.unmount()); jest.restoreAllMocks(); });

test('equal slots include row edges, reject off-row drops, and fit three cards without scrolling', () => {
  expect(slotCardWidth(320, 3, 8) * 3 + 16).toBe(320);
  expect([0, 106, 107, 213, 214, 320].map(x => cardSlotAt(x, 50, 320, 100, 3))).toEqual([0, 0, 1, 1, 2, 2]);
  expect([[-1, 50], [321, 50], [100, -1], [100, 101]].map(([x, y]) => cardSlotAt(x, y, 320, 100, 3))).toEqual([-1, -1, -1, -1]);
  expect(cardSlotAt(0, 0, 0, 100, 3)).toBe(-1);
});
test('hover only previews; release moves the stable instance into the chosen occupied slot', () => {
  begin();
  act(() => handlers().onUpdate!(event(300)));
  expect(dragging.value).toBe('a'); expect(target.value).toBe(2);
  expect(drag.x.value).toBe(260); expect(onDrop).not.toHaveBeenCalled();
  act(() => { handlers().onEnd!(event(300), true); handlers().onFinalize!(event(300), true); });
  expect(onDrop).toHaveBeenCalledTimes(1); expect(onDrop).toHaveBeenCalledWith('a', 'c');
  expect(dragging.value).toBe(''); expect(target.value).toBe(-1);
});
test('ending outside row or returning to the original slot never reorders', () => {
  begin();
  act(() => { handlers().onUpdate!(event(300)); handlers().onEnd!(event(300, 240), true); handlers().onFinalize!(event(300, 240), true); });
  expect(onDrop).not.toHaveBeenCalled();
  begin();
  act(() => { handlers().onUpdate!(event(300)); handlers().onEnd!(event(40), true); handlers().onFinalize!(event(40), true); });
  expect(onDrop).not.toHaveBeenCalled(); expect(drag.x.value).toBe(0);
});
test('third card resolves the first slot against the row origin, not its lifted frame', () => {
  act(() => view.update(<Probe width={316} index={2} />));
  // Row left=20, card width=100, gap=8: third card starts at x=236.
  act(() => { handlers().onBegin!(event(256)); handlers().onStart!(event(256)); });
  act(() => handlers().onUpdate!({ ...event(40) as any, translationX: -216 }));
  expect(target.value).toBe(0);
  act(() => { handlers().onEnd!(event(40), true); handlers().onFinalize!(event(40), true); });
  expect(onDrop).toHaveBeenCalledWith('c', 'a');
});
test('cancelled native recognizer clears lift and marker without committing', () => {
  begin();
  act(() => { handlers().onUpdate!(event(300)); handlers().onEnd!(event(300), false); handlers().onFinalize!(event(300), false); });
  expect(onDrop).not.toHaveBeenCalled(); expect(dragging.value).toBe(''); expect(drag.x.value).toBe(0);
});
test('resizing or changing membership invalidates the old gesture callbacks', () => {
  begin();
  const old = handlers();
  act(() => view.update(<Probe width={600} />));
  act(() => old.onEnd!(event(300), true));
  expect(onDrop).not.toHaveBeenCalled();
  begin(); const stale = handlers();
  act(() => view.update(<Probe width={600} ids={['a', 'replacement', 'c']} />));
  act(() => stale.onEnd!(event(500), true));
  expect(onDrop).not.toHaveBeenCalled();
});
test('backgrounding cancels the drag before any late release', () => {
  let changed: (state: string) => void = () => {};
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_, callback: any) => { changed = callback; return { remove: jest.fn() }; });
  act(() => view.update(<Probe width={330} />));
  begin();
  act(() => { changed('inactive'); handlers().onEnd!(event(300), true); });
  expect(onDrop).not.toHaveBeenCalled(); expect(dragging.value).toBe('');
});


test('put-away uses the lower half of the measured window rect, including side/bottom bounds', () => {
  const rect = { x: 10, y: 20, width: 400, height: 760 };
  expect(isPutAwayPoint(10, 400, rect)).toBe(false);
  expect(isPutAwayPoint(10, 401, rect)).toBe(true);
  expect(isPutAwayPoint(410, 780, rect)).toBe(true);
  expect([[9, 500], [411, 500], [30, 781]].map(([x, y]) => isPutAwayPoint(x, y, rect))).toEqual([false, false, false]);
  const overlappingRow = { x: 10, y: 400, width: 400, height: 100 };
  expect(resolveCardDrop('a', ['a', 'b'], 300, 450, rect, overlappingRow)).toEqual({ kind: 'remove', id: 'a' });
  expect(resolveCardDrop('missing', ['a', 'b'], 300, 450, rect, overlappingRow)).toEqual({ kind: 'cancel' });
  expect(putAwayCenter(844, 730)).toBe(609);
  expect(putAwayCenter(400, 340)).toBe(235);
});

test('arming is edge-triggered, clears insertion, and leaving permits reorder again', () => {
  begin();
  act(() => { handlers().onUpdate!(event(300)); handlers().onUpdate!(event(300, 500)); handlers().onUpdate!(event(200, 600)); });
  expect(session.armed.value).toBe(true); expect(target.value).toBe(-1);
  expect(cardHaptic).toHaveBeenCalledTimes(3); // lift, new slot, entry — not every movement
  act(() => handlers().onUpdate!(event(300)));
  expect(session.armed.value).toBe(false); expect(target.value).toBe(2);
  act(() => { handlers().onEnd!(event(300), true); handlers().onFinalize!(event(300), true); });
  expect(onDrop).toHaveBeenCalledWith('a', 'c');
  expect(cardHaptic).not.toHaveBeenCalledWith('removed');
});

test('final coordinates override hover; successful put-away commits once and does not spring home', () => {
  begin();
  act(() => handlers().onUpdate!(event(300)));
  act(() => { handlers().onEnd!(event(40, 500), true); handlers().onEnd!(event(40, 500), true); handlers().onFinalize!(event(40, 500), true); });
  expect(onDrop).toHaveBeenCalledTimes(1); expect(onDrop).toHaveBeenCalledWith('a');
  expect(drag.dismissed.value).toBe(true); expect(drag.x.value).toBe(260);
  expect(cardHaptic).toHaveBeenLastCalledWith('removed');
});

test('hovering armed then releasing above the half without another update cancels removal', () => {
  begin();
  act(() => handlers().onUpdate!(event(40, 550)));
  act(() => { handlers().onEnd!(event(40, 350), true); handlers().onFinalize!(event(40, 350), true); });
  expect(onDrop).not.toHaveBeenCalled(); expect(drag.dismissed.value).toBe(false);
  expect(drag.x.value).toBe(0); expect(drag.y.value).toBe(0);
});

test.each(['focus', 'layout', 'replacement'] as const)('queued JS removal cannot cross a %s change', reason => {
  begin(); mockQueue = [];
  act(() => { handlers().onEnd!(event(40, 550), true); handlers().onFinalize!(event(40, 550), true); });
  act(() => view.update(reason === 'focus' ? <Probe enabled={false} /> : reason === 'layout' ? <Probe width={600} /> : <Probe ids={['a', 'replacement', 'c']} />));
  const pending = mockQueue; mockQueue = null;
  act(() => pending.forEach(fn => fn()));
  expect(onDrop).not.toHaveBeenCalled(); expect(cardHaptic).not.toHaveBeenCalledWith('removed');
});

test('native cancellation while armed preserves every chart', () => {
  begin();
  act(() => { handlers().onUpdate!(event(40, 550)); handlers().onEnd!(event(40, 550), false); handlers().onFinalize!(event(40, 550), false); });
  expect(onDrop).not.toHaveBeenCalled(); expect(session.armed.value).toBe(false); expect(dragging.value).toBe('');
});


test('queued lift/armed feedback is discarded after native cancellation', () => {
  mockQueue = []; begin();
  act(() => { handlers().onUpdate!(event(40, 550)); handlers().onEnd!(event(40, 550), false); handlers().onFinalize!(event(40, 550), false); });
  const pending = mockQueue; mockQueue = null;
  act(() => pending.forEach(fn => fn()));
  expect(cardHaptic).not.toHaveBeenCalled(); expect(onDrop).not.toHaveBeenCalled();
});

test('a delayed release cannot commit after another drag starts', () => {
  begin(); mockQueue = [];
  act(() => { handlers().onEnd!(event(40, 550), true); handlers().onFinalize!(event(40, 550), true); });
  begin();
  const pending = mockQueue; mockQueue = null;
  act(() => pending.forEach(fn => fn()));
  expect(onDrop).not.toHaveBeenCalled();
  expect(cardHaptic).not.toHaveBeenCalledWith('removed');
});

test('re-entering the lower half gives a new entry feedback, but hovering does not repeat it', () => {
  begin();
  act(() => {
    handlers().onUpdate!(event(40, 550)); handlers().onUpdate!(event(60, 550));
    handlers().onUpdate!(event(40, 350)); handlers().onUpdate!(event(40, 550));
  });
  expect(jest.mocked(cardHaptic).mock.calls.filter(([kind]) => kind === 'armed')).toHaveLength(2);
});
