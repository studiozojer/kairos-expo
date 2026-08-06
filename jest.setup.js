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
