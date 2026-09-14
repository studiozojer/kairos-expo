// jest-expo does not auto-mock AsyncStorage's native module. Its own error
// message points here: https://react-native-async-storage.github.io/async-storage/docs/advanced/jest
// Not optional: `useTheme` reaches theme-context, which imports AsyncStorage.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// react-native-safe-area-context's hooks throw outside a SafeAreaProvider; the
// library ships this fallback for exactly that case. The mock file is
// `export default {...}` with no named exports, so unwrap the ESM interop.
jest.mock('react-native-safe-area-context', () => {
  const mocked = require('react-native-safe-area-context/jest/mock');
  return mocked.default ?? mocked;
});

// expo-secure-store's native module (the Keychain) does not exist under jest.
// The session module's contract is small — get/set/delete — so an in-memory
// Map stands in. Tests reach the store as `SecureStore.__store` to reset it.
jest.mock('expo-secure-store', () => {
  const store = new Map();
  return {
    getItemAsync: async (key) => (store.has(key) ? store.get(key) : null),
    setItemAsync: async (key, value) => void store.set(key, value),
    deleteItemAsync: async (key) => void store.delete(key),
    __store: store,
  };
});

// Skia: the package ships its own jest setup — install it verbatim rather
// than hand-mocking. Docs (see jest.config.js for the URL) prescribe
// `setupFilesAfterEnv: ["@shopify/react-native-skia/jestSetup.js"]`; this
// repo's convention is ONE setup file (this one, in `setupFiles`), and
// `jest.mock` is available in both phases — jest-expo's own preset setup.js
// (also `setupFiles`) calls it. Their jestSetup.js mocks
// @shopify/react-native-skia with a CanvasKit-backed implementation: `Skia`
// is real (path math works in tests), `Canvas` becomes a plain RN View, and
// the asset hooks (useSVG/useImage/useData) return null.
require('@shopify/react-native-skia/jestSetup.js');

// Native gesture events use the package's test harness (including modal roots).
require('react-native-gesture-handler/jestSetup');
