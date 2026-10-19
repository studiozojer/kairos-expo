import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Text } from 'react-native';
import { useTheme } from '@/theme';
import { Action, Note, Toggle } from '@/features/chart/display/controls';

export const CONTEXTUAL_TIPS_KEY = 'kairos.contextualTipsEnabled';
type Tips = {
  enabled: boolean;
  saveError: boolean;
  setEnabled: (enabled: boolean) => void;
  dismiss: (id: string) => void;
  isVisible: (id: string) => boolean;
};
const Context = createContext<Tips | null>(null);

/** The preference survives launch; learned gestures reset with the app session. */
export function ContextualTipsProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState(true);
  const [saveError, setSaveError] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const touched = useRef(false);
  const writes = useRef(Promise.resolve());
  const generation = useRef(0);
  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(CONTEXTUAL_TIPS_KEY).then(raw => {
      if (active && !touched.current) setEnabledState(raw !== 'false');
    }, () => { if (active && !touched.current) setSaveError(true); });
    return () => { active = false; };
  }, []);
  const setEnabled = useCallback((next: boolean) => {
    touched.current = true;
    setEnabledState(next);
    if (next) setDismissed(new Set());
    setSaveError(false);
    const current = ++generation.current;
    // Serialize rapid toggles; an older disk write cannot overwrite the latest.
    writes.current = writes.current.catch(() => {}).then(() => AsyncStorage.setItem(CONTEXTUAL_TIPS_KEY, String(next))).then(
      () => { if (generation.current === current) setSaveError(false); },
      () => { if (generation.current === current) setSaveError(true); },
    );
  }, []);
  const dismiss = useCallback((id: string) => setDismissed(previous => new Set(previous).add(id)), []);
  const value = useMemo<Tips>(() => ({ enabled, saveError, setEnabled, dismiss, isVisible: id => enabled && !dismissed.has(id) }), [enabled, saveError, setEnabled, dismiss, dismissed]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
const defaults: Tips = { enabled: true, saveError: false, setEnabled: () => {}, dismiss: () => {}, isVisible: () => true };
export function useContextualTips() { return useContext(Context) ?? defaults; }

export function ContextualTip({ children, visible = true }: { children: ReactNode; visible?: boolean }) {
  const t = useTheme();
  const { enabled } = useContextualTips();
  if (!enabled || !visible) return null;
  return <Text pointerEvents="none" style={[t.type.whyteXs, { color: t.color.txTertiary, textAlign: 'center', paddingVertical: 4 }]}>{children}</Text>;
}
export function ContextualTipsSetting() {
  const tips = useContextualTips();
  return <>
    <Toggle label="Show contextual tips" detail="Small reminders beside chart controls. Applies throughout the app on this device." value={tips.enabled} onChange={tips.setEnabled} />
    {tips.saveError && <><Note>Couldn’t read or save this preference on this device.</Note><Action label="Retry saving tips preference" onPress={() => tips.setEnabled(tips.enabled)} /></>}
  </>;
}
