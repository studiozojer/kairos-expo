import { DEFAULT_LIBRARY_PREFERENCES, type LibraryPreferences, type LibrarySort } from '../library/preferences';
import { AppState } from 'react-native';
import { captureSession, isCurrentSession, type SessionSnapshot } from '@/auth/session';
import { useOptionalAuth } from '@/auth/auth-context';
import { getChartLibrary, type ChartLibraryStore } from '../library/store';
import type { LibrarySyncState } from '../library/types';
import { syncCharts, SyncInterrupted } from '../library/sync';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useChartSettings } from '../settings/useChartSettings';
import { DEFAULT_SETTINGS, parseSettings, SETTINGS_KEY, type ChartSettings } from '../settings/chartSettings';
import { TIME_STEPS } from '../time/timeSteps';
import { useSteppedChart } from '../time/useSteppedChart';
import { seekEvent, type EventSeekSnapshot, changeTarget, moveInstance, newChartId, nowInstance, openInstance, removeInstance, reorderInstance, resetTarget, snapshotSettings, stepTarget, validateDraft, type ActiveChart, type ActiveSession, type ChartDraft, type SavedChart } from './model';

export type ActiveCalculation = ReturnType<typeof useSteppedChart>;
type PublishedCalculation = ActiveCalculation & { requestedTime: number; requestedSettings: ChartSettings };
function CalculationWorker({ chart, publish }: { chart: ActiveChart; publish: (id: string, value: PublishedCalculation) => void }) {
  const calculation = useSteppedChart(new Date(chart.time).toISOString(), chart.settings, true);
  const { result, status, retry } = calculation;
  useEffect(() => { publish(chart.id, { result, status, retry, requestedTime: chart.time, requestedSettings: chart.settings }); }, [chart.id, chart.time, chart.settings, result, status, retry, publish]);
  return null;
}

function useActiveState(scope: string | null, library?: ChartLibraryStore) {
  const [libraryPreferences, setLibraryPreferences] = useState<LibraryPreferences>(DEFAULT_LIBRARY_PREFERENCES);
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
  const appDefaults = useChartSettings();
  const defaults = useRef(DEFAULT_SETTINGS);
  useEffect(() => { if (appDefaults.loaded) defaults.current = appDefaults.settings; }, [appDefaults.loaded, appDefaults.settings]);
  const mounted = useRef(true);
  const [calculations, setCalculations] = useState<Record<string, PublishedCalculation>>({});
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const store = useRef<ChartLibraryStore | null>(library ?? null);
  const [syncState, setSyncState] = useState<LibrarySyncState | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [anonymousCount, setAnonymousCount] = useState(0);
  const syncController = useRef<AbortController | null>(null);
  const syncAgain = useRef(false);
  const [syncAttempt, setSyncAttempt] = useState(0);
  const persist = useCallback((value: ActiveSession) => {
    const generation = ++revision.current;
    const snapshot = JSON.parse(JSON.stringify(value)) as ActiveSession;
    setSaving(true);
    writes.current = writes.current.then(() => store.current!.saveSession(scope, snapshot)).then(() => {
      if (mounted.current && generation === revision.current) { setSaveError(false); setSaving(false); }
    }, () => {
      if (mounted.current && generation === revision.current) { setSaveError(true); setSaving(false); }
    });
  }, [scope]);
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const preferences = await AsyncStorage.getItem(SETTINGS_KEY).catch(() => null);
        defaults.current = parseSettings(preferences);
        const repository = library ?? await getChartLibrary();
        store.current = repository;
        const value = await repository.load(scope, defaults.current);
        const libraryPrefs = await repository.loadPreferences(scope);
        if (!alive) return;
        current.current = value;
        hydrated.current = true;
        setSession(value);
        setLibraryPreferences(libraryPrefs);
        setLoaded(true);
        persist(value);
      } catch {
        if (alive) { setLoadError(true); setLoaded(false); }
      }
    })();
    return () => { alive = false; };
  }, [loadAttempt, persist, library, scope]);
  const commit = useCallback((next: ActiveSession) => {
    if (!hydrated.current || !mounted.current) return false;
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
  const refreshLibrary = useCallback(async () => {
    const repository = store.current;
    if (!repository) return;
    const [value, anonymous, status] = await Promise.all([
      repository.load(scope, defaults.current), repository.load(null, defaults.current),
      scope ? repository.syncState(scope) : Promise.resolve(null),
    ]);
    if (!mounted.current) return;
    const active = current.current.active.map(chart => chart.sourceId && !value.saved.some(saved => saved.id === chart.sourceId)
      ? { ...chart, kind: 'snapshot' as const, sourceId: undefined } : chart);
    const detached = active.some((chart, i) => chart !== current.current.active[i]);
    current.current = { ...current.current, saved: value.saved, active };
    setSession(current.current);
    setSyncState(status); setAnonymousCount(anonymous.saved.length);
    if (detached) persist(current.current);
  // Read the current session ref so incoming sync never rewinds a time step.
  }, [scope, persist]);
  const runSync = useCallback(async () => {
    if (!scope || !store.current || !hydrated.current || (AppState.currentState && AppState.currentState !== 'active')) return;
    try {
      if (!(await store.current.syncState(scope)).enabled || !mounted.current || (AppState.currentState && AppState.currentState !== 'active')) return;
    } catch {
      if (mounted.current) setSyncError('Could not read the sync queue. Retry after local storage is available.');
      return;
    }
    if (syncController.current) { syncAgain.current = true; return; }
    const controller = new AbortController(); syncController.current = controller;
    setSyncing(true); setSyncError(null);
    try {
      do {
        syncAgain.current = false;
        await syncCharts(store.current, scope, controller.signal, refreshLibrary);
      } while (syncAgain.current && !controller.signal.aborted);
    } catch (error) {
      if (mounted.current && !controller.signal.aborted && !(error instanceof SyncInterrupted)) setSyncError(error instanceof Error ? error.message : 'Unable to sync. Your charts are saved locally.');
    } finally {
      if (syncController.current === controller) syncController.current = null;
      if (mounted.current) {
        setSyncing(false); await refreshLibrary().catch(() => {});
        if (controller.signal.aborted && syncAgain.current) { syncAgain.current = false; setSyncAttempt(attempt => attempt + 1); }
      }
    }
  }, [scope, refreshLibrary]);
  const reloadLibrary = useCallback(async () => {
    await refreshLibrary();
    if (mounted.current) setLibraryError(null);
    await runSync();
  }, [refreshLibrary, runSync]);
  useEffect(() => {
    if (!loaded) return;
    void refreshLibrary().then(() => runSync()).catch(() => { if (mounted.current) setLibraryError('Could not read chart library.'); });
    const sub = AppState.addEventListener('change', value => {
      if (value === 'active') void runSync(); else syncController.current?.abort();
    });
    const timer = setInterval(() => { if (AppState.currentState === 'active') void runSync(); }, 30000);
    return () => { clearInterval(timer); sub.remove(); syncController.current?.abort(); };
  }, [loaded, refreshLibrary, runSync, syncAttempt]);
  const saveChart = useCallback(async (draft: ChartDraft, id?: string, expected?: ChartDraft): Promise<SavedChart> => {
    if (!hydrated.current || !mounted.current || !store.current) throw new Error('Wait for charts to finish loading');
    setLibraryError(null);
    try {
      const chart = await store.current.saveChart(scope, draft, id, expected);
      await refreshLibrary();
      void runSync();
      return chart;
    } catch (error) { if (mounted.current) setLibraryError('Could not save this chart. Your previous saved version is unchanged.'); throw error; }
  }, [scope, refreshLibrary, runSync]);
  const setFavorite = useCallback(async (id: string, value: boolean) => {
    if (!hydrated.current || !mounted.current || !store.current) throw new Error('Wait for charts to finish loading');
    setLibraryError(null);
    try { await store.current.setFavorite(scope, id, value); await refreshLibrary(); void runSync(); }
    catch (error) { if (mounted.current) setLibraryError('Could not update favorite. Please try again.'); throw error; }
  }, [scope, refreshLibrary, runSync]);
  const tagSuggestionsFor = useCallback(async (id?: string) => {
    if (!store.current) return [];
    return store.current.tagSuggestions(scope, id);
  }, [scope]);
  const setLibrarySort = useCallback(async (sort: LibrarySort) => {
    if (!hydrated.current || !mounted.current || !store.current) return;
    try {
      const value = await store.current.setLibrarySort(scope, sort);
      if (mounted.current) setLibraryPreferences(previous => ({ ...previous, sort: value.sort }));
    } catch (error) { if (mounted.current) setLibraryError('Could not save library sorting. Please try again.'); throw error; }
  }, [scope]);
  const deleteSaved = useCallback(async (id: string) => {
    if (!hydrated.current || !mounted.current || !store.current) return;
    setLibraryError(null);
    try { await store.current.deleteChart(scope, id); await refreshLibrary(); void runSync(); }
    catch { if (mounted.current) setLibraryError('Could not delete this chart. Please try again.'); }
  }, [scope, refreshLibrary, runSync]);
  const setSyncEnabled = useCallback(async (enabled: boolean, includeAnonymous = false, expected?: SessionSnapshot) => {
    if (!scope || !store.current || !hydrated.current || !mounted.current) return;
    const captured = expected ?? await captureSession();
    const authorized = () => mounted.current && !!captured && captured.account.did === scope && isCurrentSession(captured);
    if (!authorized()) return;
    syncAgain.current = false;
    syncController.current?.abort();
    setLibraryError(null); setSyncError(null);
    try {
      if (enabled) await store.current.enableSync(scope, includeAnonymous, authorized);
      else await store.current.disableSync(scope);
      await refreshLibrary();
      if (enabled) void runSync();
    } catch (error) { if (mounted.current) setLibraryError(error instanceof Error ? error.message : 'Could not change sync settings. Please try again.'); }
  }, [scope, refreshLibrary, runSync]);
  const open = useCallback((chart: ActiveChart, replaceId?: string) => {
    const next = openInstance(current.current, chart, replaceId);
    return !!next && commit(next);
  }, [commit]);
  const openSaved = useCallback((savedId: string, replaceId?: string) => {
    const saved = current.current.saved.find(chart => chart.id === savedId);
    if (!saved) return false;
    const time = Date.parse(saved.datetime);
    const opened = open({ id: newChartId(), sourceId: saved.id, kind: 'saved', name: saved.name, origin: time, time, settings: snapshotSettings(saved.settings), unit: 2 }, replaceId);
    if (opened) {
      const timestamp = Date.now();
      setLibraryPreferences(previous => ({ ...previous, opened: { ...previous.opened, [savedId]: timestamp } }));
      void store.current!.markOpened(scope, savedId, timestamp).catch(() => {
        if (mounted.current) setLibraryError('Chart opened, but its recent-open time could not be saved.');
      });
    }
    return opened;
  }, [open, scope]);
  const addNow = useCallback((replaceId?: string) => open(nowInstance(defaults.current), replaceId), [open]);
  const remove = useCallback((id: string) => { commit(removeInstance(current.current, id)); setCalculations(previous => { const next = { ...previous }; delete next[id]; return next; }); }, [commit]);
  const move = useCallback((id: string, direction: -1 | 1) => { commit(moveInstance(current.current, id, direction)); }, [commit]);
  const moveTo = useCallback((id: string, targetId: string) => {
    const next = reorderInstance(current.current, id, targetId);
    if (next !== current.current) commit(next);
  }, [commit]);
  const selectTarget = useCallback((id: string) => { if (current.current.active.some(chart => chart.id === id)) commit({ ...current.current, targetId: id }); }, [commit]);
  const updateInstanceSettings = useCallback((id: string, settings: ChartSettings) => {
    validateDraft({ name: 'Settings', datetime: new Date().toISOString(), settings });
    commit({ ...current.current, active: current.current.active.map(chart => chart.id === id ? { ...chart, settings: snapshotSettings(settings) } : chart) });
  }, [commit]);
  const step = useCallback((direction: -1 | 1) => { commit(stepTarget(current.current, direction)); }, [commit]);
  const seek = useCallback((snapshot: EventSeekSnapshot, time: number) => {
    const next = seekEvent(current.current, snapshot, time);
    return next !== current.current && commit(next);
  }, [commit]);
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
  return { ...session, defaultSettings: appDefaults.settings, updateDefaultSettings: appDefaults.update, libraryPreferences, setLibrarySort, setFavorite, tagSuggestionsFor, scope, syncState, syncing, syncError, libraryError, anonymousCount, runSync, reloadLibrary, setSyncEnabled, deleteSaved, loaded, saveError, loadError, saving, calculations: visibleCalculations, saveChart, openSaved, addNow, remove, move, moveTo, selectTarget, updateInstanceSettings, step, seek, reset, selectUnit, retryPersistence, retryLoad, publish };
}
const Context = createContext<Omit<ReturnType<typeof useActiveState>, 'publish'> | null>(null);
export function ActiveChartsProvider({ children, library }: { children: ReactNode; library?: ChartLibraryStore }) {
  const auth = useOptionalAuth();
  if (auth && !auth.ready) return null;
  return <ScopedChartsProvider key={auth?.account?.did ?? 'anonymous'} scope={auth?.account?.did ?? null} library={library}>{children}</ScopedChartsProvider>;
}
function ScopedChartsProvider({ children, scope, library }: { children: ReactNode; scope: string | null; library?: ChartLibraryStore }) {
  const { publish, ...value } = useActiveState(scope, library);
  return <Context.Provider value={value}>{value.loaded && value.active.map(chart => <CalculationWorker key={chart.id} chart={chart} publish={publish} />)}{children}</Context.Provider>;
}
export function useActiveCharts() {
  const value = useContext(Context);
  if (!value) throw new Error('Active charts require ActiveChartsProvider');
  return value;
}
