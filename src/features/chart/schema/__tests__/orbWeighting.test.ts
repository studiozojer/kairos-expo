import { parseAspectOverlayStyle, serializeAspectOverlayStyle } from '../ring-styles';
import { parsePreset, serializePreset } from '../preset';
import classic from '../../fixtures/presets/classic.json';
import { editPresetDocument, presetDocument } from '../../display/presetDocument';

test('old presets keep uniform thickness and edits roundtrip without losing extensions', () => {
  const document = presetDocument({ ...classic, futureExtension: { kept: true } });
  expect(document.preset.aspectOverlay.orbWeighting).toBe(0);
  const edited = editPresetDocument(document, { ...document.preset, aspectOverlay: { ...document.preset.aspectOverlay, lineWidth: 2, orbWeighting: .65 } });
  expect((edited.source as any).futureExtension).toEqual({ kept: true });
  expect(parsePreset(edited.source).aspectOverlay).toMatchObject({ lineWidth: 2, orbWeighting: .65 });
  expect(parsePreset(serializePreset(edited.preset)).aspectOverlay.orbWeighting).toBe(.65);
  const off = { ...edited.preset, aspectOverlay: { ...edited.preset.aspectOverlay, orbWeighting: 0 } };
  expect(parsePreset(editPresetDocument(edited, off).source).aspectOverlay.orbWeighting).toBe(0);
});
test.each([[undefined, 0], [null, 0], ['50', 0], [NaN, 0], [Infinity, 0], [-1, 0], [2, 1], [.5, .5]])('bounds serialized weighting %s', (input, expected) => {
  const style = parseAspectOverlayStyle({ orbWeighting: input });
  expect(style.orbWeighting).toBe(expected);
  expect(parseAspectOverlayStyle(serializeAspectOverlayStyle(style)).orbWeighting).toBe(expected);
});
