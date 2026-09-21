import { useEffect } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AppState } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import { cardSlotAt, slotCardWidth } from '../cardSlots';
import { useCardDrag } from '../useCardDrag';

jest.mock('react-native-reanimated', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    useSharedValue: (initial: unknown) => React.useRef({ value: initial }).current,
    runOnJS: (fn: unknown) => fn, cancelAnimation: () => {}, withSpring: (value: number) => value,
  };
});
const dragging = { value: '' } as any, target = { value: -1 } as any;
const onDrop = jest.fn();
let drag: ReturnType<typeof useCardDrag>, view: ReactTestRenderer;
function Probe({ width = 320, ids = ['a', 'b', 'c'], index = 0 }: { width?: number; ids?: string[]; index?: number }) {
  const result = useCardDrag({ id: ids[index], index, ids, width, height: 100, gap: 8, dragging, target, onDrop });
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
  jest.clearAllMocks(); dragging.value = ''; target.value = -1;
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
