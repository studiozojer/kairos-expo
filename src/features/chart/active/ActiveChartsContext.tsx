import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { DEFAULT_SETTINGS, parseSettings, SETTINGS_KEY, type ChartSettings } from '../settings/chartSettings';
import { TIME_STEPS } from '../time/timeSteps';
import { useSteppedChart } from '../time/useSteppedChart';
import { ACTIVE_CHARTS_KEY, changeTarget, initialSession, moveInstance, newChartId, nowInstance, openInstance, parseSession, removeInstance, resetTarget, snapshotSettings, stepTarget, validateDraft, type ActiveChart, type ActiveSession, type ChartDraft, type SavedChart } from './model';

export type ActiveCalculation = ReturnType<typeof useSteppedChart>;
type PublishedCalculation = ActiveCalculation & { requestedTime: number; requestedSettings: ChartSettings };
function CalculationWorker({ chart, publish }: { chart: ActiveChart; publish: (id: string, value: PublishedCalculation) => void }) {
  const calculation = useSteppedChart(new Date(chart.time).toISOString(), chart.settings, true);
  const { result, status, retry } = calculation;
  useEffect(() => { publish(chart.id, { result, status, retry, requestedTime: chart.time, requestedSettings: chart.settings }); }, [chart.id, chart.time, chart.settings, result, status, retry, publish]);
  return null;
}

function useActiveState() {
  const [session, setSession] = useState<ActiveSession>({ version: 1, saved: [], active: [], targetId: null });
  const current = useRef(session);
  const [loaded, setLoaded] = useState(false);
  const hydrated = useRef(false);
  const [loadError, setLoadError] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const writes = useRef(Promise.resolve());
  const revision = useRef(0);
  const defaults = useRef(DEFAULT_SETTINGS);
  const mounted = useRef(true);
  const [calculations, setCalculations] = useState<Record<string, PublishedCalculation>>({});
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const persist = useCallback((value: ActiveSession) => {
    const generation = ++revision.current;
    const raw = JSON.stringify(value);
    setSaving(true);
    writes.current = writes.current.then(() => AsyncStorage.setItem(ACTIVE_CHARTS_KEY, raw)).then(() => {
      if (mounted.current && generation === revision.current) { setSaveError(false); setSaving(false); }
    }, () => {
      if (mounted.current && generation === revision.current) { setSaveError(true); setSaving(false); }
    });
  }, []);
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const [raw, preferences] = await Promise.all([
          AsyncStorage.getItem(ACTIVE_CHARTS_KEY),
          AsyncStorage.getItem(SETTINGS_KEY).catch(() => null),
        ]);
        defaults.current = parseSettings(preferences);
        // Existing calculation defaults are preferences, never imported charts.
        let value: ActiveSession;
        if (raw === null) {
          value = initialSession(defaults.current);
        } else value = parseSession(raw);
        if (!alive) return;
        current.current = value;
        hydrated.current = true;
        setSession(value);
        setLoaded(true);
        if (raw === null) persist(value);
      } catch {
        if (alive) { setLoadError(true); setLoaded(false); }
      }
    })();
    return () => { alive = false; };
  }, [loadAttempt, persist]);
  const commit = useCallback((next: ActiveSession) => {
    if (!hydrated.current) return false;
    current.current = next;
    setSession(next);
    persist(next);
    return true;
  }, [persist]);
  const publish = useCallback((id: string, value: PublishedCalculation) => {
    if (current.current.active.some(chart => chart.id === id)) setCalculations(previous => Object.fromEntries(current.current.active.flatMap(chart => {
      const calculation = chart.id === id ? value : previous[chart.id];
      return calculation ? [[chart.id, calculation]] : [];
    })));
  }, []);
  const saveChart = useCallback((draft: ChartDraft, id?: string): SavedChart => {
    if (!hydrated.current) throw new Error('Wait for charts to finish loading');
    validateDraft(draft);
    if (id && !current.current.saved.some(chart => chart.id === id)) throw new Error('Saved chart no longer exists');
    const chart = { ...draft, name: draft.name.trim(), datetime: new Date(draft.datetime).toISOString(), settings: snapshotSettings(draft.settings), id: id ?? newChartId() };
    const saved = id ? current.current.saved.map(item => item.id === id ? chart : item) : [...current.current.saved, chart];
    commit({ ...current.current, saved });
    return chart;
  }, [commit]);
  const open = useCallback((chart: ActiveChart, replaceId?: string) => {
    const next = openInstance(current.current, chart, replaceId);
    return !!next && commit(next);
  }, [commit]);
  const openSaved = useCallback((savedId: string, replaceId?: string) => {
    const saved = current.current.saved.find(chart => chart.id === savedId);
    if (!saved) return false;
    const time = Date.parse(saved.datetime);
    return open({ id: newChartId(), sourceId: saved.id, kind: 'saved', name: saved.name, origin: time, time, settings: snapshotSettings(saved.settings), unit: 2 }, replaceId);
  }, [open]);
  const addNow = useCallback((replaceId?: string) => open(nowInstance(defaults.current), replaceId), [open]);
  const remove = useCallback((id: string) => { commit(removeInstance(current.current, id)); setCalculations(previous => { const next = { ...previous }; delete next[id]; return next; }); }, [commit]);
  const move = useCallback((id: string, direction: -1 | 1) => { commit(moveInstance(current.current, id, direction)); }, [commit]);
  const selectTarget = useCallback((id: string) => { if (current.current.active.some(chart => chart.id === id)) commit({ ...current.current, targetId: id }); }, [commit]);
  const updateInstanceSettings = useCallback((id: string, settings: ChartSettings) => {
    validateDraft({ name: 'Settings', datetime: new Date().toISOString(), settings });
    commit({ ...current.current, active: current.current.active.map(chart => chart.id === id ? { ...chart, settings: snapshotSettings(settings) } : chart) });
  }, [commit]);
  const step = useCallback((direction: -1 | 1) => { commit(stepTarget(current.current, direction)); }, [commit]);
  const reset = useCallback(() => { commit(resetTarget(current.current)); }, [commit]);
  const selectUnit = useCallback((index: number) => {
    if (Number.isInteger(index)) commit(changeTarget(current.current, chart => ({ ...chart, unit: Math.max(0, Math.min(TIME_STEPS.length - 1, index)) })));
  }, [commit]);
  const retryPersistence = useCallback(() => { if (hydrated.current) persist(current.current); }, [persist]);
  const retryLoad = useCallback(() => { if (!hydrated.current) { setLoadError(false); setLoadAttempt(value => value + 1); } }, []);
  // Worker effects publish after render; immediately mark changed requests loading.
  const visibleCalculations: Record<string, ActiveCalculation> = {};
  for (const chart of session.active) {
    const calculation = calculations[chart.id];
    if (calculation) visibleCalculations[chart.id] = { ...calculation, status: calculation.requestedTime === chart.time && calculation.requestedSettings === chart.settings ? calculation.status : 'loading' };
  }
  return { ...session, loaded, saveError, loadError, saving, calculations: visibleCalculations, saveChart, openSaved, addNow, remove, move, selectTarget, updateInstanceSettings, step, reset, selectUnit, retryPersistence, retryLoad, publish };
}
const Context = createContext<Omit<ReturnType<typeof useActiveState>, 'publish'> | null>(null);
export function ActiveChartsProvider({ children }: { children: ReactNode }) {
  const { publish, ...value } = useActiveState();
  return <Context.Provider value={value}>{value.loaded && value.active.map(chart => <CalculationWorker key={chart.id} chart={chart} publish={publish} />)}{children}</Context.Provider>;
}
export function useActiveCharts() {
  const value = useContext(Context);
  if (!value) throw new Error('Active charts require ActiveChartsProvider');
  return value;
}
