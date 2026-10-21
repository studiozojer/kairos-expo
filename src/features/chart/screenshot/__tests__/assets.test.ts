import { requiredGlyphs } from '../renderExport';
import { GLYPH_ASSETS } from '../../render/glyph-map.gen';
import { buildConfiguration } from '../../config/buildConfiguration';
import { TEMPLATE_NAMES, displayTemplate } from '../../display/templates';
import { renderingPreset } from '../../display/model';
import fixture from '../../fixtures/engine/sibly-1776.json';
import type { ChartCalculationResponse } from '../../config/engine-types';
jest.mock('expo-file-system', () => ({}));

test('preload covers the signs, retrograde mark and every planet used by the shared renderer', () => {
  const cfg = buildConfiguration(fixture as ChartCalculationResponse, renderingPreset(displayTemplate('classic')!));
  const names = requiredGlyphs(cfg);
  expect(names.filter(name => name.startsWith('signs/'))).toHaveLength(12);
  expect(names).toContain('rx');
  for (const ring of cfg.rings) if (ring.type.kind === 'planets') {
    for (const placement of ring.type.placements) expect(names).toContain(`celestials/${placement.glyphAsset}`);
  }
  expect(new Set(names).size).toBe(names.length);
  for (const name of names) expect(Object.hasOwn(GLYPH_ASSETS,name)).toBe(true);
});

test.each(TEMPLATE_NAMES)("preloads only mapped glyphs for bundled %s", name => {
  const cfg = buildConfiguration(fixture as ChartCalculationResponse, renderingPreset(displayTemplate(name)!));
  for (const glyph of requiredGlyphs(cfg)) expect(Object.hasOwn(GLYPH_ASSETS,glyph)).toBe(true);
});
