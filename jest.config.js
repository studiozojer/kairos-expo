// Moved out of package.json because merging jest-expo's own preset requires a
// `require(...)` call, which JSON cannot express.
//
// EXTEND jest-expo's `transformIgnorePatterns`, never replace it wholesale —
// replacing silently drops the preset's own entries (the reanimated-plugin and
// RN-babel-preset excludes among them) and cost armillary-expo a debugging day.
// When a package needs transforming, add it to `extraTransformedPackages` below.
const jestExpoPreset = require('jest-expo/jest-preset');

const [presetAllowlist, ...presetRestPatterns] = jestExpoPreset.transformIgnorePatterns;

// Packages this repo needs transformed that jest-expo's own allowlist does not
// already cover. Empty at scaffold time; Stage 1 (Skia) will likely add
// '@shopify/react-native-skia' here.
const extraTransformedPackages = [];

module.exports = {
  preset: 'jest-expo',
  // AsyncStorage's native module is not auto-mocked by jest-expo; the theme
  // mode provider reaches it, so every render test needs the vendor mock.
  setupFiles: ['<rootDir>/jest.setup.js'],
  modulePathIgnorePatterns: ['<rootDir>/.worktrees/'],
  transformIgnorePatterns: [
    presetAllowlist.replace(/\)\)$/, extraTransformedPackages.length
      ? `|${extraTransformedPackages.join('|')}))`
      : '))'),
    ...presetRestPatterns,
  ],
};
