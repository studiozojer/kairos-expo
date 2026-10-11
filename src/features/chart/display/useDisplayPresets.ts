import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { PresetRepository } from './repository';
const repository = new PresetRepository(AsyncStorage);
/** One device-local owner also keeps pending writes ordered across route remounts. */
export function useDisplayPresets() {
  const [, refresh] = useState(0);
  useEffect(() => {
    const unsubscribe = repository.subscribe(() => refresh(value => value + 1));
    void repository.load();
    return unsubscribe;
  }, []);
  return repository;
}
