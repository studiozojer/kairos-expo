import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DEFAULT_SETTINGS, parseSettings, SETTINGS_KEY, type ChartSettings } from './chartSettings';

export function useChartSettings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const writes = useRef(Promise.resolve());
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(SETTINGS_KEY).then(raw => {
      if (active) setSettings(parseSettings(raw));
    }).catch(() => { if (active) setSaveError(true); })
      .finally(() => { if (active) setLoaded(true); });
    return () => { active = false; };
  }, []);
  const update = useCallback((next: ChartSettings) => {
    setSettings(next);
    // Serialize writes so rapid comparisons cannot persist an older selection last.
    writes.current = writes.current.then(() => AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next)))
      .then(() => setSaveError(false), () => setSaveError(true));
  }, []);
  return { settings, loaded, update, saveError };
}
