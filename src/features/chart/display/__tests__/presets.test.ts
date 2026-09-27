import { BUNDLED_PRESET_NAMES, bundledPreset, bundledPresetSource } from '../presets';
import { planetStyles } from '../sharedControls';
import { DEFAULT_PATTERN_ORB, parsePreset } from '../../schema/preset';
import classic from '../../fixtures/presets/classic.json';

test.each(BUNDLED_PRESET_NAMES)('%s starts with the requested Expo display defaults in every ring count', name => {
  for (const preset of [bundledPreset(name)!.preset, parsePreset(bundledPresetSource(name))]) {
    expect(preset.aspectOverlay.orbWeighting).toBe(1);
    expect(preset.aspects.showPatterns).toBe(true);
    expect(preset.aspectOverlay).toMatchObject({ patternOpacity: .05, patternOrbWeighting: .75 });
    expect(preset.aspects.patterns?.orb ?? DEFAULT_PATTERN_ORB).toBe(5);
    const styles = planetStyles(preset);
    expect(styles.length).toBeGreaterThan(0);
    expect(styles.every(s => !s.showMinuteText && s.showSignGlyph)).toBe(true);
  }
});
test('product defaults do not modify the Swift reference fixtures', () => {
  const before = JSON.stringify(classic);
  bundledPresetSource('classic');
  expect(JSON.stringify(classic)).toBe(before);
  expect(bundledPreset('missing')).toBeUndefined();
});
