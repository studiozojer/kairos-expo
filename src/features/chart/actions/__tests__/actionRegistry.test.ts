import { ACTION_IDS, createActionRegistry } from '../actionRegistry';
import { context } from '../testContext';

test('every listed action has a working handler, with explicit arguments', async () => {
  const c = context(); const registry = createActionRegistry(() => c);
  for (const id of ACTION_IDS) expect(await registry.execute(id)).toEqual({ status: 'executed' });
  for (const fn of [c.resetOrientation, c.openLibrary, c.addNow, c.openSettings, c.openDisplay, c.toggleOrientation, c.screenshot, c.reset]) expect(fn).toHaveBeenCalledTimes(1);
  expect(c.rotateOrientation).toHaveBeenNthCalledWith(1, -1); expect(c.rotateOrientation).toHaveBeenNthCalledWith(2, 1);
  expect(c.step).toHaveBeenNthCalledWith(1, -1); expect(c.step).toHaveBeenNthCalledWith(2, 1);
  expect(c.toggleDisplay).toHaveBeenNthCalledWith(1, 'enabled');
  expect(c.toggleDisplay).toHaveBeenNthCalledWith(2, 'showPatterns');
  expect(c.toggleDisplay).toHaveBeenNthCalledWith(3, 'showFalseAspects');
});
test('unknown and unavailable requests never reach handlers', async () => {
  const c = context(); const registry = createActionRegistry(() => c);
  expect(await registry.execute('__proto__')).toEqual({ status: 'unknown' });
  expect(await registry.execute('legacyAction')).toEqual({ status: 'unknown' });
  c.enabled = false;
  for (const id of ACTION_IDS) expect(await registry.execute(id)).toEqual({ status: 'unavailable' });
  expect(c.openSettings).not.toHaveBeenCalled(); expect(c.step).not.toHaveBeenCalled();
  c.enabled = true; c.canStepBackward = false;
  expect(registry.describe('time.backward').enabled).toBe(false);
  expect(registry.describe('time.forward').enabled).toBe(true);
  c.hasTarget = false;
  expect(await registry.execute('time.reset')).toEqual({ status: 'unavailable' });
});
test('stored action calls use current state and target handlers', async () => {
  let c = context(); const old = c;
  const registry = createActionRegistry(() => c);
  const savedCall = () => registry.execute('time.forward');
  c = { ...context(), locked: false, targetKind: 'now' };
  expect(registry.describe('orientation.toggle')).toMatchObject({ label: 'Lock chart', selected: false, icon: 'unlock' });
  expect(registry.describe('time.reset').label).toBe('Return to now');
  expect(registry.describe('display.falseAspects').selected).toBe(false);
  await savedCall(); expect(c.step).toHaveBeenCalledWith(1); expect(old.step).not.toHaveBeenCalled();
  c.enabled = false;
  expect(await savedCall()).toEqual({ status: 'unavailable' });
});
test('async actions block duplicates and screenshot conflicts, then recover after failure', async () => {
  const c = context();
  let reject!: (reason: unknown) => void;
  c.screenshot = jest.fn(() => new Promise<void>((_, fail) => { reject = fail; }));
  const registry = createActionRegistry(() => c);
  const running = registry.execute('chart.screenshot');
  expect(registry.describe('chart.screenshot')).toMatchObject({ busy: true, enabled: false, label: 'Capturing chart' });
  expect(await registry.execute('chart.screenshot')).toEqual({ status: 'busy' });
  expect(await registry.execute('display.settings')).toEqual({ status: 'unavailable' });
  reject(new Error('failed'));
  expect((await running).status).toBe('failed');
  expect(registry.describe('chart.screenshot').enabled).toBe(true);
  c.screenshot = jest.fn();
  expect(await registry.execute('chart.screenshot')).toEqual({ status: 'executed' });
});

test('Now is available without a calculated chart, but waits for session hydration', async () => {
  const c = context(); c.chartEnabled = false; c.hasTarget = false;
  const registry = createActionRegistry(() => c);
  expect(await registry.execute('chart.addNow')).toEqual({ status: 'executed' });
  c.chartsLoaded = false;
  expect(await registry.execute('chart.addNow')).toEqual({ status: 'unavailable' });
  expect(c.addNow).toHaveBeenCalledTimes(1);
  expect(registry.describe('chart.library').enabled).toBe(true);
});
