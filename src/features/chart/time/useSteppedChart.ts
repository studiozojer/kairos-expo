import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChartCalculationResponse } from '../config/engine-types';
import { calculateChart } from '../data/calculateChart';
import type { ChartSettings } from '../settings/chartSettings';

type Request = { datetime: string; settings: ChartSettings; attempt: number };
type Result = Request & { chart: ChartCalculationResponse };

/** One running native calculation and one replaceable pending request.
 * Keep the last rendered chart/time together while the newest target computes. */
export function useSteppedChart(datetime: string, settings: ChartSettings, enabled: boolean) {
  const [result, setResult] = useState<Result>();
  const [settled, setSettled] = useState<{ request: Request; status: 'ready' | 'error' }>();
  const [attempt, setAttempt] = useState(0);
  const queue = useRef<{ pending?: Request; latest?: Request; running: boolean }>({ running: false });
  const retry = useCallback(() => setAttempt(value => value + 1), []);

  useEffect(() => {
    const state = queue.current;
    if (!enabled) return;
    const request = { datetime, settings, attempt };
    state.pending = state.latest = request;

    async function drain() {
      if (state.running) return;
      state.running = true;
      try {
        while (state.pending) {
          const next = state.pending;
          state.pending = undefined;
          try {
            const chart = await calculateChart(next.datetime, next.settings);
            if (state.latest === next) {
              setResult({ ...next, chart });
              setSettled({ request: next, status: 'ready' });
            }
          } catch (error) {
            if (state.latest === next) {
              console.warn('Could not update the chart', error);
              setSettled({ request: next, status: 'error' });
            }
          }
        }
      } finally {
        state.running = false;
      }
    }
    void drain();
    return () => {
      // Also invalidates on unmount, blur, settings changes, retry and StrictMode cleanup.
      if (state.latest === request) state.latest = undefined;
      if (state.pending === request) state.pending = undefined;
    };
  }, [datetime, settings, enabled, attempt]);

  const status = settled?.request.datetime === datetime && settled.request.settings === settings && settled.request.attempt === attempt
    ? settled.status : 'loading';
  return { result, status, retry };
}
