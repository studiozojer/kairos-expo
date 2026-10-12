import { starRingGuidance } from '../ringContext';
import { createRing } from '../../display/model';
import { displayTemplate } from '../../display/templates';
const charts = [{ id: 'a', name: 'Natal', status: 'ready' }, { id: 'b', name: 'Now', status: 'ready' }];
test('stable chart context follows slot changes and never attributes another source’s ring to the target', () => {
  const preset = displayTemplate('classic')!;
  preset.layouts[2].rings.push(createRing('fixedStars', 1));
  expect(starRingGuidance(preset, charts, { layout: 2, chartId: 'b' }).message).toContain('Another chart source');
  const moved = starRingGuidance(preset, [...charts].reverse(), { layout: 2, chartId: 'b' });
  expect(moved.sourceSlot).toBe(1); expect(moved.message).toContain('ring is enabled');
  const removed = starRingGuidance(preset, [charts[0]], { layout: 2, chartId: 'b' });
  expect(removed.manageable).toBe(false); expect(removed.message).toContain('no longer open');
});
test('inactive editing layout, disabled rings and calculation failures have distinct explanations', () => {
  const preset = displayTemplate('classic')!;
  const ring = createRing('fixedStars', 1); ring.enabled = false; preset.layouts[1].rings.push(ring);
  const context = starRingGuidance(preset, [{ ...charts[0], status: 'error', missingStars: ['Unknown'] }, charts[1]], { layout: 1, chartId: 'a' });
  expect(context.message).toContain('inactive layout'); expect(context.message).toContain('ring is hidden');
  expect(context.message).toContain('Calculation failed'); expect(context.message).toContain('Unknown');
  ring.enabled = true;
  const enabled = starRingGuidance(preset, charts, { layout: 1, chartId: 'a' });
  expect(enabled.message).toContain('configures presentation'); expect(enabled.message).not.toContain('visible');
});
