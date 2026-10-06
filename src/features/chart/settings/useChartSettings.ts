import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_SETTINGS, parseSettings, SETTINGS_KEY, validCalculationSettings, type ChartSettings } from './chartSettings';

type Listener = (settings: ChartSettings) => void;
const listeners = new Set<Listener>();
let revision = 0;
let writes = Promise.resolve();
export function useChartSettings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    let active = true;
    const before = revision;
    const receive: Listener = value => { if (active) setSettings(value); };
    listeners.add(receive);
    AsyncStorage.getItem(SETTINGS_KEY).then(raw => {
      if (active && revision === before) setSettings(parseSettings(raw));
    }).catch(() => { if (active) setSaveError(true); })
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; listeners.delete(receive); };
  }, []);
  const update = useCallback((next: ChartSettings) => {
    if (!validCalculationSettings(next)) throw new Error('Unsupported chart defaults');
    revision++;
    setSettings(next);
    listeners.forEach(listener => listener(next));
    // Serialize writes so rapid comparisons cannot persist an older selection last.
    writes = writes.then(() => AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next)))
      .then(() => setSaveError(false), () => setSaveError(true));
  }, []);
  return { settings, loaded, update, saveError };
}
