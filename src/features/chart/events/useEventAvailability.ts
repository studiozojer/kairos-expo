import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { fetchEventCapabilities } from './api';
import type { EventCapabilities } from './types';

type Availability = { capabilities: EventCapabilities | null; status: 'checking' | 'available' | 'unavailable' };
const unavailable: Availability = { capabilities: null, status: 'unavailable' };

/** The service's own readiness response is the gate, not network reachability. */
export function useEventAvailability(enabled: boolean) {
  const [state, setState] = useState<Availability>(unavailable);
  const retryRef = useRef<() => void>(() => {});
  const invalidateRef = useRef<() => void>(() => {});
  const retry = useCallback(() => retryRef.current(), []);
  const markUnavailable = useCallback(() => invalidateRef.current(), []);
  useEffect(() => {
    let disposed = false;
    let foreground = AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
    let pending: AbortController | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const cancel = () => { clearTimeout(timer); pending?.abort(); pending = null; };
    const schedule = () => { clearTimeout(timer); if (!disposed && enabled && foreground) timer = setTimeout(check, 30_000); };
    async function check() {
      if (disposed || !enabled || !foreground || pending) return;
      clearTimeout(timer);
      const controller = new AbortController();
      pending = controller;
      setState(previous => previous.status === 'available' ? previous : { capabilities: null, status: 'checking' });
      try {
        const capabilities = await fetchEventCapabilities(controller.signal);
        if (!disposed && pending === controller) setState(capabilities.available ? { capabilities, status: 'available' } : unavailable);
      } catch {
        if (!disposed && pending === controller) setState(unavailable);
      } finally {
        if (pending === controller) { pending = null; schedule(); }
      }
    }
    retryRef.current = check;
    invalidateRef.current = () => { cancel(); setState(unavailable); schedule(); };
    const subscription = AppState.addEventListener('change', next => {
      foreground = next === 'active';
      if (!foreground) { cancel(); setState(unavailable); }
      else void check();
    });
    // Readiness belongs to this foreground subscription; never reuse a previous scope.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState(unavailable);
    void check();
    return () => {
      disposed = true; cancel(); subscription.remove();
      retryRef.current = () => {}; invalidateRef.current = () => {};
    };
  }, [enabled]);
  return { ...(enabled ? state : unavailable), retry, markUnavailable };
}
