import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { EventServiceError, fetchEventCapabilities } from './api';
import type { EventCapabilities } from './types';

type Availability = { capabilities: EventCapabilities | null; status: 'checking' | 'available' | 'unavailable' };
const unavailable: Availability = { capabilities: null, status: 'unavailable' };
const retryDelays = [2_000, 5_000, 10_000, 30_000];

/** Screen lifetime owns readiness; sheets and individual failed calculations do not. */
export function useEventAvailability(enabled: boolean) {
  const [state, setState] = useState<Availability>(unavailable);
  const retryRef = useRef<() => void>(() => {});
  const failureRef = useRef<(error: unknown) => void>(() => {});
  const retry = useCallback(() => retryRef.current(), []);
  const reportFailure = useCallback((error: unknown) => failureRef.current(error), []);
  useEffect(() => {
    let disposed = false;
    let foreground = AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
    let pending: AbortController | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    const cancel = () => { clearTimeout(timer); pending?.abort(); pending = null; };
    const schedule = (delay: number) => { clearTimeout(timer); if (!disposed && enabled && foreground) timer = setTimeout(check, delay); };
    async function check() {
      if (disposed || !enabled || !foreground || pending) return;
      clearTimeout(timer);
      const controller = new AbortController();
      pending = controller;
      let healthy = false;
      try {
        const capabilities = await fetchEventCapabilities(controller.signal);
        if (!disposed && pending === controller) {
          healthy = capabilities.available;
          setState(healthy ? { capabilities, status: 'available' } : unavailable);
        }
      } catch {
        if (!disposed && pending === controller) setState(unavailable);
      } finally {
        if (pending === controller) {
          pending = null;
          if (healthy) { failures = 0; schedule(30_000); }
          else { schedule(retryDelays[Math.min(failures, retryDelays.length - 1)]); failures++; }
        }
      }
    }
    retryRef.current = check;
    failureRef.current = error => {
      if (disposed || !enabled || !foreground || (error instanceof Error && error.name === 'AbortError')) return;
      // Invalidate before starting another check: a delayed old success cannot undo this failure.
      cancel();
      if (error instanceof EventServiceError && (error.kind === 'http' || error.kind === 'invalid_response')) {
        void check();
      } else {
        setState(unavailable);
        failures = 0;
        schedule(2_000);
      }
    };
    const subscription = AppState.addEventListener('change', next => {
      foreground = next === 'active';
      if (!foreground) { cancel(); setState(unavailable); }
      else { failures = 0; void check(); }
    });
    // Readiness belongs to this foreground subscription; never reuse a previous scope.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(enabled && foreground ? { capabilities: null, status: 'checking' } : unavailable);
    void check();
    return () => {
      disposed = true; cancel(); subscription.remove();
      retryRef.current = () => {}; failureRef.current = () => {};
    };
  }, [enabled]);
  return { ...(enabled ? state : unavailable), retry, reportFailure };
}
