import { DIRECTIONS, MarkingMenuController, markingDirection } from '../markingMenuState';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());
const center = { x: 100, y: 100 };
test('eight sectors, wrapped east boundary and center dead zone', () => {
  DIRECTIONS.forEach((direction, i) => expect(markingDirection(100 * Math.cos(i * Math.PI / 4), 100 * Math.sin(i * Math.PI / 4))).toBe(direction));
  expect(markingDirection(19, 0)).toBeUndefined();
  expect(markingDirection(20, 0)).toBe('e');
  expect(markingDirection(100, -1)).toBe('e');
  expect(markingDirection(0, -100)).toBe('n');
});
test('quick tap runs once, cancels delayed reveal and never selects a slot', () => {
  const changed = jest.fn(), tap = jest.fn(), select = jest.fn();
  const menu = new MarkingMenuController(changed);
  const token = menu.begin('display', center, [{ id: 'east', position: 'e', label: 'Test', onSelect: select }], tap);
  jest.advanceTimersByTime(50);
  menu.end(token, 0, 0); menu.end(token, 0, 0);
  jest.runAllTimers();
  expect(tap).toHaveBeenCalledTimes(1); expect(select).not.toHaveBeenCalled(); expect(menu.current).toBeNull();
});
test('hold reveals at 100ms and an empty menu releases without a tap', () => {
  const tap = jest.fn(), menu = new MarkingMenuController(jest.fn());
  const token = menu.begin('empty', center, [], tap);
  jest.advanceTimersByTime(99); expect(menu.current?.shown).toBe(false);
  jest.advanceTimersByTime(1); expect(menu.current?.shown).toBe(true);
  jest.advanceTimersByTime(100); menu.end(token, 0, 0);
  expect(tap).not.toHaveBeenCalled(); expect(menu.current).toBeNull();
});
test('release position determines selection, missing and disabled slots cancel', () => {
  const tap = jest.fn(), east = jest.fn(), south = jest.fn();
  const options = [{ id: 'east', position: 'e' as const, label: 'East', onSelect: east }, { id: 'south', position: 's' as const, label: 'South', onSelect: south, disabled: true }];
  const menu = new MarkingMenuController(jest.fn());
  let token = menu.begin('menu', center, options, tap);
  menu.update(token, 0, 100); menu.end(token, 100, 0);
  expect(east).toHaveBeenCalledTimes(1);
  for (const [x, y] of [[0, 100], [-100, 0], [0, 0]]) {
    token = menu.begin('menu', center, options, tap);
    menu.update(token, 100, 0); menu.end(token, x, y);
  }
  expect(east).toHaveBeenCalledTimes(1); expect(south).not.toHaveBeenCalled(); expect(tap).not.toHaveBeenCalled();
});
test('stale timers, updates and releases cannot affect a new owner', () => {
  const tap = jest.fn(), menu = new MarkingMenuController(jest.fn());
  const old = menu.begin('old', center, [], tap);
  expect(menu.begin('competitor', center, [], tap)).toBeUndefined();
  menu.cancelOwner('old');
  const current = menu.begin('current', center, [], tap);
  menu.update(old, 100, 0); menu.end(old, 0, 0); menu.cancel(old);
  expect(menu.current?.token).toBe(current); expect(menu.current?.shown).toBe(false);
  menu.dispose(); jest.runAllTimers(); expect(menu.current).toBeNull(); expect(tap).not.toHaveBeenCalled();
});

test('disabled provider rejects a queued begin until re-enabled', () => {
  const menu = new MarkingMenuController(jest.fn());
  menu.setEnabled(false);
  expect(menu.begin('queued', center, [])).toBeUndefined();
  menu.setEnabled(true);
  expect(menu.begin('fresh', center, [])).toBeDefined();
  menu.dispose();
});
