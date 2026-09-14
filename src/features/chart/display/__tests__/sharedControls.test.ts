import classic from '../../fixtures/presets/classic.json';
import { editPresetDocument, presetDocument } from '../presetDocument';
import { CHART_SLOTS, planetStyles, updateOrientation, updatePlanetStyles } from '../sharedControls';
import { parsePreset } from '../../schema/preset';

it('applies label changes to every planet ring without changing layout or other styling', () => {
  const preset = parsePreset(classic);
  const next = updatePlanetStyles(preset, { showMinuteText: true });
  expect(planetStyles(next).length).toBeGreaterThanOrEqual(6);
  expect(planetStyles(next).every(s => s.showMinuteText)).toBe(true);
  for (const slot of CHART_SLOTS) {
    expect(next[slot].globalSettings).toBe(preset[slot].globalSettings);
    expect(next[slot].rings.map(r => [r.id, r.type, r.thickness, r.content])).toEqual(preset[slot].rings.map(r => [r.id, r.type, r.thickness, r.content]));
  }
  const stripMinutes = (p: typeof preset) => planetStyles(p).map(({ showMinuteText, ...rest }) => rest);
  expect(stripMinutes(next)).toEqual(stripMinutes(preset));
});

it('sizes symbols independently from annotations and applies orientation to all slots', () => {
  const preset = parsePreset(classic);
  const next = updatePlanetStyles(preset, { glyphSize: 24 });
  expect(planetStyles(next).map(s => s.degreeTextFontSize)).toEqual(planetStyles(preset).map(s => s.degreeTextFontSize));
  const oriented = updateOrientation(next, 90);
  expect(CHART_SLOTS.map(slot => oriented[slot].globalSettings.staticOrientationDegree)).toEqual([90, 90, 90]);
});

it('retains foreign fields, metadata and unknown rings through repeated edits', () => {
  const source = JSON.parse(JSON.stringify(classic));
  source.authorDid = 'did:plc:owner';
  source.extensions = { 'other.app': { version: 4, custom: ['keep'] } };
  const planet = source.soloChart.rings.find((r: { ringType: string }) => r.ringType === 'planets');
  planet.style.foreignField = { untouched: true };
  source.soloChart.rings.push({ id: 'foreign', ringType: 'other.app.ring', style: { $type: 'other.app.style', secret: 42 } });
  let doc = presetDocument(source);
  doc = editPresetDocument(doc, updatePlanetStyles(doc.preset, { showMinuteText: !planet.style.showMinuteText }));
  doc = editPresetDocument(doc, updateOrientation(doc.preset, 120));
  const output = doc.source as typeof source;
  expect(output.authorDid).toBe(source.authorDid);
  expect(output.extensions).toEqual(source.extensions);
  expect(output.soloChart.rings.at(-1)).toEqual(source.soloChart.rings.at(-1));
  expect(output.soloChart.rings.find((r: { id: string }) => r.id === planet.id).style.foreignField).toEqual({ untouched: true });
  expect(parsePreset(output)).toEqual(doc.preset);
  expect(source.soloChart.globalSettings.staticOrientationDegree).toBe(classic.soloChart.globalSettings.staticOrientationDegree);
});
