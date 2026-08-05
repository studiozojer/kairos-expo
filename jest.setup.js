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
