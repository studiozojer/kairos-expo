import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { useChartSettings } from '../settings/useChartSettings';
import { MAX_TIME, MIN_TIME, stepTime, TIME_STEPS } from './timeSteps';
import { useSteppedChart } from './useSteppedChart';

function useChartTimeState(enabled: boolean) {
  const defaults = useChartSettings();
  const [clock, setClock] = useState(() => { const now = Date.now(); return { time: now, origin: now }; });
  const [unit, setUnit] = useState(2);
  const datetime = new Date(clock.time).toISOString();
  const calculation = useSteppedChart(datetime, defaults.settings, defaults.loaded && enabled);
  const step = useCallback((direction: -1 | 1) => {
    setClock(current => ({ ...current, time: stepTime(current.time, unit, direction) }));
  }, [unit]);
  const selectUnit = useCallback((index: number) => setUnit(Math.max(0, Math.min(TIME_STEPS.length - 1, index))), []);
  const reset = useCallback(() => { const now = Date.now(); setClock({ time: now, origin: now }); }, []);
  return { ...defaults, ...calculation, ...clock, datetime, unit, selectUnit, step, reset,
    canStepBackward: defaults.loaded && enabled && clock.time > MIN_TIME,
    canStepForward: defaults.loaded && enabled && clock.time < MAX_TIME };
}

const ChartTimeContext = createContext<ReturnType<typeof useChartTimeState> | null>(null);

// Both native accessory placements and the chart share this owner. Never keep
// selected time/unit in BottomAccessory: UIKit mounts two copies of its content.
export function ChartTimeProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const state = useChartTimeState(enabled);
  return <ChartTimeContext.Provider value={state}>{children}</ChartTimeContext.Provider>;
}

export function useChartTime() {
  const value = useContext(ChartTimeContext);
  if (!value) throw new Error('Chart time requires ChartTimeProvider');
  return value;
}
