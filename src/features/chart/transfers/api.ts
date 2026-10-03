import { authorizedFetch, isCurrentSession, type SessionSnapshot } from '@/auth/session';

export class ArchiveDownloadError extends Error {}

function waitForRetry(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); reject(new Error('Archive download stopped')); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, milliseconds);
    signal.addEventListener('abort', abort);
    if (signal.aborted) abort();
  });
}

export async function archiveRequest(path: string, session: SessionSnapshot, signal: AbortSignal, init: RequestInit = {}) {
  const current = () => !signal.aborted && isCurrentSession(session);
    // Large libraries exceed the API's per-IP burst allowance. Retry the same
    // read after Retry-After; never skip a snapshot or advance a partial page.
    for (let attempt = 0; attempt < 3; attempt++) {
      if (!current()) throw new Error('Archive download stopped');
      const controller = new AbortController();
      const abort = () => controller.abort(); signal.addEventListener('abort', abort);
      const timer = setTimeout(abort, 15000);
      try {
        const headers = new Headers(init.headers); headers.set('Cache-Control', 'no-store');
        const response = await authorizedFetch(`/api/chart-transfers/v1${path}`, { ...init, signal: controller.signal, redirect: 'error', headers }, session);
        if (response.status === 429) {
          if (attempt === 2) throw new ArchiveDownloadError('The server is busy downloading charts. Pull to refresh to resume.');
          const header = response.headers.get('Retry-After');
          const seconds = header === null ? NaN : Number(header);
          const dateDelay = header === null ? NaN : Date.parse(header) - Date.now();
          const delay = Number.isFinite(seconds) ? seconds * 1000 : dateDelay;
          clearTimeout(timer);
          await waitForRetry(Number.isFinite(delay) ? Math.min(60000, Math.max(1000, delay)) : 1000, signal);
          continue;
        }
        if (!response.ok) throw new ArchiveDownloadError(response.status === 404 ? 'Transferred charts are not available on the server yet.' : `Could not download transferred charts (HTTP ${response.status}). Pull to refresh to resume.`);
        // Bound transport before parsing; individual snapshots have their own decoded bound.
        const text = await response.text();
        if (text.length > 1024 * 1024 || !current()) throw new Error('Invalid or interrupted archive response');
        return JSON.parse(text) as unknown;
      } finally { clearTimeout(timer); signal.removeEventListener('abort', abort); }
    }
    throw new ArchiveDownloadError('Could not finish downloading transferred charts. Pull to refresh to resume.');
}
