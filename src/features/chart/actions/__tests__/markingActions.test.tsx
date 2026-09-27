import { markingActions, type ActionSlots } from '../markingActions';
import { createActionRegistry } from '../actionRegistry';
import { context } from '../testContext';
jest.mock('../../marking/MarkingIcon', () => ({ MarkingIcon: 'MarkingIcon' }));
test('slot IDs are unique, unavailable actions stay disabled, and removed IDs are ignored', () => {
  const c = context(); c.canStepForward = false;
  const registry = createActionRegistry(() => c); const invoke = jest.fn();
  const slots = { e: 'time.forward', w: 'time.forward', n: 'removed.action' } as unknown as ActionSlots;
  const options = markingActions(slots, { describe: registry.describe, invoke }, '#fff');
  expect(options).toHaveLength(2);
  expect(new Set(options.map(o => o.id)).size).toBe(2);
  expect(options.every(o => o.disabled)).toBe(true);
  // The adapter retains an ID only; the executor remains responsible for the
  // current availability check, even if a menu captured this old callback.
  options[0].onSelect(); expect(invoke).toHaveBeenCalledWith('time.forward');
});
