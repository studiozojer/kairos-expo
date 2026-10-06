import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '@/auth/auth-context';
import { captureSession, subscribeSession, isCurrentSession } from '@/auth/session';
import { getChartArchive } from './store';
import { retrieveArchive } from './sync';
import type { ArchivedChart } from './types';
import { importAccountArchive, type ConversionPreview } from './conversion';
import { downloadAccountCharts } from '../library/sync';
import { getChartLibrary } from '../library/store';
import { useActiveCharts } from '../active/ActiveChartsContext';

interface ArchiveState { scope: string | null; records: ArchivedChart[]; downloading: boolean; initialLoading: boolean; previews: ConversionPreview[]; error: string | null; refresh: () => Promise<void> }
const Context = createContext<ArchiveState | null>(null);
export function ArchiveProvider({ children }: { children: ReactNode }) {
  const { account, ready } = useAuth();
  if (!ready) return null;
  return <ScopedArchive key={account?.did ?? 'anonymous'} did={account?.did ?? null}>{children}</ScopedArchive>;
}
function ScopedArchive({ did, children }: { did: string | null; children: ReactNode }) {
  const { reloadLibrary } = useActiveCharts();
  const reloadLibraryRef = useRef(reloadLibrary);
  useEffect(() => { reloadLibraryRef.current = reloadLibrary; }, [reloadLibrary]);
  const [records, setRecords] = useState<ArchivedChart[]>([]);
  const [downloading, setDownloading] = useState(false);
  const [settled, setSettled] = useState(!did);
  const [previews, setPreviews] = useState<ConversionPreview[]>([]);
  const [error, setError] = useState<string | null>(null);
  const active = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const refresh = useCallback(async () => {
    if (!did || (active.current && !active.current.signal.aborted)) return;
    const controller = new AbortController(); active.current = controller;
    const live = () => mounted.current && active.current === controller && !controller.signal.aborted;
    try {
      const store = await getChartArchive();
      if (!live()) return;
      setDownloading(true); setError(null);
      const publish = async () => { const charts = await store.list(did); if (live()) { setRecords(charts); setPreviews(values => values.filter(p => charts.some(r => r.transferId === p.transferId && r.snapshotId === p.snapshotId))); } };
      await publish();
      const session = await captureSession();
      if (!live() || session?.account.did !== did) return;
      const library = await getChartLibrary();
      const reload = async () => { if (live() && isCurrentSession(session)) await reloadLibraryRef.current(); };
      await downloadAccountCharts(library, session, controller.signal, reload);
      await retrieveArchive(store, did, controller.signal, publish, session);
      const assessments = await importAccountArchive(await store.list(did), session, controller.signal, library, reload, values => {
        if (live() && isCurrentSession(session) && values.length) {
          // Keep previously assessed pages visible until their replacements arrive.
          setPreviews(previous => [
            ...previous.map(p => values.find(v => v.transferId === p.transferId) ?? p),
            ...values.filter(v => !previous.some(p => p.transferId === v.transferId)),
          ]);
        }
      });
      if (live() && isCurrentSession(session)) setPreviews(assessments);
      // Recover mapping revisions after newly created destinations, without a second assessment pass.
      await retrieveArchive(store, did, controller.signal, publish, session);
    } catch {
      if (live()) setError('Couldn’t load all your account charts. Downloaded charts remain available.');
    }
    finally {
      if (mounted.current && active.current === controller) { setDownloading(false); setSettled(true); active.current = null; }
    }
  }, [did]);
  useEffect(() => {
    mounted.current = true;
    // Begin retrieval when the external storage connection becomes available.
    if (did) void getChartArchive().then(() => refresh()).catch(() => {
      if (mounted.current) { setError('Couldn’t load account charts on this device.'); setSettled(true); }
    });
    const unsubscribe = subscribeSession(() => { active.current?.abort(); void refresh(); });
    const foreground = AppState.addEventListener('change', state => {
      if (state === 'active') void refresh(); else active.current?.abort();
    });
    return () => { mounted.current = false; active.current?.abort(); unsubscribe(); foreground.remove(); };
  }, [did, refresh]);
  return <Context.Provider value={{ scope: did, records, previews, downloading, initialLoading: !settled, error, refresh }}>{children}</Context.Provider>;
}
export function useChartArchive() {
  const value = useContext(Context);
  if (!value) throw new Error('Chart archive requires ArchiveProvider');
  return value;
}

/** Saved Charts can render outside this provider in isolated local previews. */
export function useAccountCharts() { return useContext(Context); }
