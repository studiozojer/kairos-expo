// Test environment per Skia's jest docs
// (https://shopify.github.io/react-native-skia/docs/getting-started/installation#testing-with-jest):
// `@shopify/react-native-skia/jestEnv.js` preloads the CanvasKit WASM into
// `global.CanvasKit` so the package's own mock (wired in jest.setup.js) can
// run the REAL Skia JS API (Skia.Path.Make() & co.) against it.
//
// One deviation, forced by composition: Skia's jestEnv.js extends bare
// `jest-environment-node`, but jest-expo's preset points testEnvironment at
// `@react-native/jest-preset/jest/react-native-env.js`, which adds
// `customExportConditions = ['require', 'react-native']`. Overwriting the env
// wholesale would drop RN's export-condition resolution. So: extend the RN
// env, add Skia's CanvasKit preload verbatim.
const ReactNativeEnv = require('@react-native/jest-preset/jest/react-native-env.js');
const CanvasKitInit = require('canvaskit-wasm/bin/full/canvaskit');

module.exports = class SkiaReactNativeEnvironment extends ReactNativeEnv {
  async setup() {
    await super.setup();
    const init = CanvasKitInit.default ?? CanvasKitInit;
    this.global.CanvasKit = await init({});
  }
};
