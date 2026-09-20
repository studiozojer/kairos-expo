import React from 'react';
import { act, create } from 'react-test-renderer';
import { buildConfiguration } from '../../config/buildConfiguration';
import fixture from '../../fixtures/engine/seattle-2026.json';
import { bundledPreset } from '../../display/presets';
import { toggleBody } from '../../display/displayPreset';
import { useWheelLayout, type WheelLayout } from '../../render/useWheelLayout';
import { chartTargets, selectionColor, cuspSelectionOpacity, hitTarget, selectionOpacity, selectionPaint, toggleSelection } from '../selection';
import { ChartWheelCanvas } from '../../render/ChartWheel';
import { themeFor } from '@/theme';
import { AspectOverlay } from '../../render/AspectOverlay';
const preset = bundledPreset('classic')!.preset;
const config = buildConfiguration(fixture, preset);
let layout: WheelLayout;
function Probe() { const result = useWheelLayout(config, 400); React.useEffect(() => { layout = result; }); return null; }
beforeAll(() => { let view: ReturnType<typeof create>; act(() => { view = create(<Probe />); }); act(() => view!.unmount()); });

test('body hit targets are the actual displaced glyph positions at every zoom', () => {
  const targets = chartTargets(layout);
  const positions = [...layout.planetLayouts.values()].flat();
  for (const pos of positions) {
    const target = targets.find(t => t.id === pos.placement.id)!;
    expect(target.x).toBe(pos.adjustedPosition.x);
    expect(target.y).toBe(pos.adjustedPosition.y);
    for (const scale of [1, 2, 3]) {
      const transform = { scale, x: 45, y: -12 };
      const point = { x: (target.x - 200) * scale + 245, y: (target.y - 200) * scale + 188 };
      expect(hitTarget(targets, point, transform, 400)).toBe(target.id);
    }
  }
  expect(hitTarget(targets, { x: -1000, y: -1000 }, { scale: 3, x: 0, y: 0 }, 400)).toBeNull();
});
test('multi-selection toggles independently and empty taps clear it', () => {
  let ids = toggleSelection([], 'sun'); ids = toggleSelection(ids, 'moon');
  expect(ids).toEqual(['sun', 'moon']);
  expect(toggleSelection(ids, 'sun')).toEqual(['moon']);
  expect(toggleSelection(ids, null)).toEqual([]);
});
test('selection stays on the body ID, and hidden bodies lose their selection', () => {
  const targets = chartTargets(layout);
  const moved = targets.map(t => t.id === 'sun' ? { ...t, x: t.x + 30, detail: 'New degree' } : t);
  expect(selectionPaint(['sun'], moved, config, preset.selection).selected.has('sun')).toBe(true);
  const hidden = buildConfiguration(fixture, toggleBody(preset, 'Sun', false));
  expect(selectionPaint(['sun'], targets.filter(t => t.id !== 'sun'), hidden, preset.selection).selected.size).toBe(0);
});
test('the selected body highlights its containing sign/house and respects opacity switches', () => {
  const targets = chartTargets(layout), sun = targets.find(t => t.id === 'sun')!;
  const style = { ...preset.selection, unselectedOpacity: .2, relatedOpacity: .8, affectsGlyphs: true, ignoreZodiacRingOpacity: false };
  const paint = selectionPaint(['sun'], targets, config, style);
  expect(selectionOpacity(paint, 'sun', 'affectsGlyphs')).toBe(1);
  expect(selectionOpacity(paint, 'moon', 'affectsGlyphs')).toBe(.2);
  const sign = `sign:${sun.placement!.signPlacement.toLowerCase()}`;
  expect(selectionOpacity(paint, sign, 'affectsGlyphs', true)).toBe(.8);
  expect(paint.related.has(`house:${sun.placement!.housePlacement}`)).toBe(true);
  expect(selectionOpacity({ ...paint, style: { ...style, affectsGlyphs: false } }, 'moon', 'affectsGlyphs')).toBe(1);
  expect(selectionOpacity({ ...paint, style: { ...style, ignoreZodiacRingOpacity: true } }, 'sign:aries', 'affectsGlyphs', true)).toBe(1);
});
test('selected IDs reach the aspect renderer instead of the previous empty placeholder', () => {
  const paint = selectionPaint(['sun'], chartTargets(layout), config, preset.selection);
  let view: ReturnType<typeof create>;
  act(() => { view = create(<ChartWheelCanvas size={400} config={config} layout={layout} selection={paint} />); });
  expect(view!.root.findByType(AspectOverlay).props.selectedIdentifiers).toEqual(new Set(['sun']));
  act(() => view!.unmount());
});

test('unrelated colors respect element switches and zodiac exclusion', () => {
  const targets = chartTargets(layout);
  const paint = selectionPaint(['sun'], targets, config, { ...preset.selection,
    unselectedColor: { source: 'hex', value: '#123456', layer: 'ic' } });
  const theme = themeFor('dark');
  expect(selectionColor(paint, 'moon', 'affectsGlyphs', '#ffffff', theme)).toBe('#123456');
  expect(selectionColor(paint, 'sun', 'affectsGlyphs', '#ffffff', theme)).toBe('#ffffff');
  const related = [...paint.related][0];
  expect(selectionColor(paint, related, 'affectsGlyphs', '#ffffff', theme)).toBe('#ffffff');
  expect(selectionColor({ ...paint, style: { ...paint.style, affectsDegreeText: false } }, 'moon', 'affectsDegreeText', '#ffffff', theme)).toBe('#ffffff');
  expect(selectionColor({ ...paint, style: { ...paint.style, ignoreZodiacRingOpacity: true } }, 'sign:aries', 'affectsGlyphs', '#ffffff', theme, true)).toBe('#ffffff');
});
test('both house boundaries are related, including the 12/1 wrap', () => {
  const paint = selectionPaint(['house:12'], chartTargets(layout), config, { ...preset.selection, relatedOpacity: .7, unselectedOpacity: .2 });
  expect(cuspSelectionOpacity(paint, 11)).toBe(.7);
  expect(cuspSelectionOpacity(paint, 0)).toBe(.7);
  expect(cuspSelectionOpacity(paint, 1)).toBe(.2);
  expect(cuspSelectionOpacity({ ...paint, style: { ...paint.style, affectsCuspLines: false } }, 1)).toBe(1);
});
test.each([['sign:aries'], ['house:1'], ['sun', 'house:1'], ['sun', 'moon', 'sign:aries']])('only celestial selections reach aspect filtering: %j', (...ids) => {
  const paint = selectionPaint(ids, chartTargets(layout), config, preset.selection);
  let view: ReturnType<typeof create>;
  act(() => { view = create(<ChartWheelCanvas size={400} config={config} layout={layout} selection={paint} />); });
  expect(view!.root.findByType(AspectOverlay).props.selectedIdentifiers).toEqual(new Set(ids.filter(id => id === 'sun' || id === 'moon')));
  act(() => view!.unmount());
});

test('planet and zodiac renderers receive the unselected color while selected glyphs retain theirs', () => {
  const paint = selectionPaint(['sun'], chartTargets(layout), config, { ...preset.selection,
    unselectedColor: { source: 'hex', value: '#123456', layer: 'ic' } });
  let view: ReturnType<typeof create>;
  act(() => { view = create(<ChartWheelCanvas size={400} config={config} layout={layout} selection={paint} />); });
  const glyphs = view!.root.findAll(node => typeof node.props.name === 'string' && typeof node.props.size === 'number' && typeof node.props.color === 'string');
  const moon = glyphs.find(g => g.props.name === 'celestials/moon')!;
  const sun = glyphs.find(g => g.props.name === 'celestials/sun')!;
  expect(moon.props.color).toBe('#123456');
  expect(sun.props.color).not.toBe('#123456');
  expect(sun.props.selected).toBe(true);
  const unrelatedSign = chartTargets(layout).find(t => t.kind === 'sign' && !paint.related.has(t.id))!;
  expect(glyphs.find(g => g.props.name === `signs/${unrelatedSign.id.slice(5)}`)!.props.color).toBe('#123456');
  act(() => view!.unmount());
});
