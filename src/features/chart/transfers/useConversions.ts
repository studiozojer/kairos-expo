import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { captureSession, isCurrentSession } from '@/auth/session';
import { getChartLibrary } from '../library/store';
import { addTransferredChart, previewConversions, type ConversionPreview } from './conversion';
import type { ArchivedChart } from './types';

export function useConversions(did: string | null, records: ArchivedChart[], refreshLibrary: () => Promise<void>, refreshArchive: () => Promise<void>) {
  const [previews, setPreviews] = useState<ConversionPreview[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const active = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const latest = useRef(records);
  useEffect(() => { latest.current = records; }, [records]);
  useEffect(() => {
    mounted.current = true;
    // The containing archive provider remounts this screen for each account.
    const listener = AppState.addEventListener('change', state => { if (state !== 'active') active.current?.abort(); });
    return () => { mounted.current = false; active.current?.abort(); listener.remove(); };
  }, [did]);
  const check = useCallback(async () => {
    active.current?.abort();
    if (!did) return;
    const controller = new AbortController(); active.current = controller;
    const live = () => mounted.current && active.current === controller && !controller.signal.aborted;
    setBusy(true); setError(null);
    try {
      const session = await captureSession();
      if (!session || session.account.did !== did || !live()) return;
      const assessment = await previewConversions(latest.current, session, controller.signal);
      if (live() && isCurrentSession(session)) setPreviews(assessment);
    } catch (error) { if (live()) setError(error instanceof Error ? error.message : 'Could not check compatibility.'); }
    finally { if (mounted.current && active.current === controller) setBusy(false); }
  }, [did]);
  const add = useCallback(async (selection: ConversionPreview[], reviewed: boolean) => {
    if (!did || busy || !selection.length) return;
    const controller = new AbortController(); active.current?.abort(); active.current = controller;
    const live = () => mounted.current && active.current === controller && !controller.signal.aborted;
    setBusy(true); setError(null);
    let added = 0;
    try {
      const session = await captureSession();
      if (!session || session.account.did !== did || !live()) return;
      const library = await getChartLibrary();
      for (const preview of selection) {
        if (!live() || !isCurrentSession(session)) throw new Error('Account changed; saved progress remains available.');
        if (!latest.current.some(r => r.transferId === preview.transferId && r.snapshotId === preview.snapshotId)) throw new Error('A source chart changed. Check compatibility again.');
        await addTransferredChart(preview, reviewed, session, controller.signal, library);
        if (!live() || !isCurrentSession(session)) return;
        added++;
        setProgress(`${added} of ${selection.length} added to Saved Charts`);
        setPreviews(values => values.map(value => value.snapshotId === preview.snapshotId ? { ...value, state: 'already_added', chart: null } : value));
      }
    } catch (error) { if (live()) setError(error instanceof Error ? error.message : 'Could not finish adding charts. Retry to resume.'); }
    finally {
      if (live()) {
        // Downloading destinations never enables ordinary sync or uploads local charts.
        await refreshLibrary().catch(() => setError('Charts were saved in your account. Refresh Saved Charts to load them here.'));
        await refreshArchive().catch(() => { if (live()) setError('Charts were saved. Refresh the transferred library to update its status.'); });
      }
      if (mounted.current && active.current === controller) setBusy(false);
    }
  }, [did, busy, refreshLibrary, refreshArchive]);
  // A new snapshot invalidates an old review; retain completed additions.
  const current = previews.filter(p => records.some(r => r.transferId === p.transferId && r.snapshotId === p.snapshotId));
  return { previews: current, busy, error, progress, check, add };
}
