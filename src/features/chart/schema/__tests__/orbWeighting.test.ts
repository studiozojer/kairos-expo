import { parseAspectOverlayStyle, serializeAspectOverlayStyle } from '../ring-styles';
import { parsePreset, serializePreset } from '../preset';
import classic from '../../fixtures/presets/classic.json';
import { editPresetDocument, presetDocument } from '../../display/presetDocument';

test('presets without weighting use the new default and edits roundtrip without losing extensions', () => {
  const document = presetDocument({ ...classic, futureExtension: { kept: true } });
  expect(document.preset.aspectOverlay.orbWeighting).toBe(1);
  const edited = editPresetDocument(document, { ...document.preset, aspectOverlay: { ...document.preset.aspectOverlay, lineWidth: 2, orbWeighting: .65 } });
  expect((edited.source as any).futureExtension).toEqual({ kept: true });
  expect(parsePreset(edited.source).aspectOverlay).toMatchObject({ lineWidth: 2, orbWeighting: .65 });
  expect(parsePreset(serializePreset(edited.preset)).aspectOverlay.orbWeighting).toBe(.65);
  const off = { ...edited.preset, aspectOverlay: { ...edited.preset.aspectOverlay, orbWeighting: 0 } };
  expect(parsePreset(editPresetDocument(edited, off).source).aspectOverlay.orbWeighting).toBe(0);
});
test.each([[undefined, 1], [null, 1], ['50', 1], [NaN, 1], [Infinity, 1], [-1, 0], [0, 0], [2, 2], [4, 3], [.5, .5]])('bounds serialized weighting %s', (input, expected) => {
  const style = parseAspectOverlayStyle({ orbWeighting: input });
  expect(style.orbWeighting).toBe(expected);
  expect(parseAspectOverlayStyle(serializeAspectOverlayStyle(style)).orbWeighting).toBe(expected);
});

test('pattern opacity defaults and edits survive full preset document roundtrips', () => {
  const document = presetDocument(classic);
  expect(document.preset.aspectOverlay).toMatchObject({ patternOpacity: .08, patternOrbWeighting: 0 });
  const preset = { ...document.preset, aspectOverlay: { ...document.preset.aspectOverlay, patternOpacity: .2, patternOrbWeighting: .75 } };
  expect(parsePreset(editPresetDocument(document, preset).source).aspectOverlay).toMatchObject({ patternOpacity: .2, patternOrbWeighting: .75 });
  expect(parsePreset(serializePreset(preset)).aspectOverlay).toMatchObject({ patternOpacity: .2, patternOrbWeighting: .75 });
});
test.each([undefined, null, '50', NaN, Infinity, -1, 2, .5, 0])('sanitizes pattern opacity and weighting %s', input => {
  const style = parseAspectOverlayStyle({ patternOpacity: input, patternOrbWeighting: input });
  const valid = typeof input === 'number' && Number.isFinite(input);
  expect(style.patternOpacity).toBe(valid ? Math.max(0, Math.min(1, input)) : .08);
  expect(style.patternOrbWeighting).toBe(valid ? Math.max(0, Math.min(1, input)) : 0);
});
