import { useCallback, useEffect, useState } from 'react';
import type { ChartCalculationResponse } from '../config/engine-types';
import { calculateChart } from './calculateChart';

type LoadState =
  | { status: 'loading'; chart?: undefined }
  | { status: 'ready'; chart: ChartCalculationResponse }
  | { status: 'error'; chart?: undefined };

export function useLoadTimeChart() {
  const [datetime] = useState(() => new Date().toISOString());
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const retry = useCallback(() => setAttempt(value => value + 1), []);

  useEffect(() => {
    let active = true;
    setState({ status: 'loading' });
    calculateChart(datetime).then(
      chart => { if (active) setState({ status: 'ready', chart }); },
      error => {
        if (active) {
          console.warn('Could not load transit chart', error);
          setState({ status: 'error' });
        }
      },
    );
    return () => { active = false; };
  }, [datetime, attempt]);

  return { ...state, datetime, retry };
}
