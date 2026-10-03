import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '@/auth/auth-context';
import { captureSession, subscribeSession } from '@/auth/session';
import { getChartArchive } from './store';
import { ArchiveDownloadError, retrieveArchive } from './sync';
import type { ArchivedChart } from './types';

interface ArchiveState { scope: string | null; records: ArchivedChart[]; downloading: boolean; error: string | null; refresh: () => Promise<void> }
const Context = createContext<ArchiveState | null>(null);
export function ArchiveProvider({ children }: { children: ReactNode }) {
  const { account, ready } = useAuth();
  if (!ready) return null;
  return <ScopedArchive key={account?.did ?? 'anonymous'} did={account?.did ?? null}>{children}</ScopedArchive>;
}
function ScopedArchive({ did, children }: { did: string | null; children: ReactNode }) {
  const [records, setRecords] = useState<ArchivedChart[]>([]);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const refresh = useCallback(async () => {
    active.current?.abort();
    if (!did) return;
    const controller = new AbortController(); active.current = controller;
    const live = () => mounted.current && active.current === controller && !controller.signal.aborted;
    try {
      const store = await getChartArchive();
      if (!live()) return;
      setDownloading(true); setError(null);
      const publish = async () => { const charts = await store.list(did); if (live()) setRecords(charts); };
      await publish();
      const session = await captureSession();
      if (!live() || session?.account.did !== did) return;
      await retrieveArchive(store, did, controller.signal, publish, session);
    } catch (error) {
      if (live()) setError(`${error instanceof ArchiveDownloadError ? error.message : 'Could not refresh transferred charts.'} Previously downloaded records remain available.`);
    }
    finally { if (mounted.current && active.current === controller) setDownloading(false); }
  }, [did]);
  useEffect(() => {
    mounted.current = true;
    // Begin retrieval when the external storage connection becomes available.
    if (did) void getChartArchive().then(() => refresh()).catch(() => {
      if (mounted.current) setError('Transferred charts could not be read from this device.');
    });
    const unsubscribe = subscribeSession(() => { void refresh(); });
    const foreground = AppState.addEventListener('change', state => {
      if (state === 'active') void refresh(); else active.current?.abort();
    });
    return () => { mounted.current = false; active.current?.abort(); unsubscribe(); foreground.remove(); };
  }, [did, refresh]);
  return <Context.Provider value={{ scope: did, records, downloading, error, refresh }}>{children}</Context.Provider>;
}
export function useChartArchive() {
  const value = useContext(Context);
  if (!value) throw new Error('Chart archive requires ArchiveProvider');
  return value;
}
