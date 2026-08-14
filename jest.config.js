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
// already cover. '@shopify/react-native-skia' ships ESM under lib/module/** and
// its own jest recipe (jestSetup.js below) requires transforming it — see
// https://shopify.github.io/react-native-skia/docs/getting-started/installation#testing-with-jest
const extraTransformedPackages = ['@shopify/react-native-skia'];

module.exports = {
  preset: 'jest-expo',
  // AsyncStorage's native module is not auto-mocked by jest-expo; the theme
  // mode provider reaches it, so every render test needs the vendor mock.
  setupFiles: ['<rootDir>/jest.setup.js'],
  // Skia's jest recipe (linked above) wants `testEnvironment:
  // "@shopify/react-native-skia/jestEnv.js"` — an env that preloads the
  // CanvasKit WASM into `global.CanvasKit` for its mock. Theirs extends bare
  // jest-environment-node, which would REPLACE jest-expo's env and drop RN's
  // customExportConditions ('require', 'react-native'). jest.skia-env.js is
  // theirs composed onto the RN base env: same CanvasKit preload, RN
  // resolution kept.
  testEnvironment: '<rootDir>/jest.skia-env.js',
  modulePathIgnorePatterns: ['<rootDir>/.worktrees/'],
  transformIgnorePatterns: [
    presetAllowlist.replace(/\)\)$/, extraTransformedPackages.length
      ? `|${extraTransformedPackages.join('|')}))`
      : '))'),
    ...presetRestPatterns,
  ],
};
