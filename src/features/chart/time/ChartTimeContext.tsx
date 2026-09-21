import { createContext, useContext, type ReactNode } from 'react';
import { useActiveCharts } from '../active/ActiveChartsContext';
import { DEFAULT_SETTINGS } from '../settings/chartSettings';
import { MAX_TIME, MIN_TIME } from './timeSteps';

const ChartTimeEnabled = createContext(true);

/** Navigation only gates the controls. The root active-session provider owns
 * time and calculations, including while a saved-chart editor is pushed. */
export function ChartTimeProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  return <ChartTimeEnabled.Provider value={enabled}>{children}</ChartTimeEnabled.Provider>;
}

/** Compatibility surface for the existing glass stepper. No second clock. */
export function useChartTime() {
  const session = useActiveCharts();
  const enabled = useContext(ChartTimeEnabled);
  const target = session.active.find(chart => chart.id === session.targetId);
  const calculation = target ? session.calculations[target.id] : undefined;
  const time = target?.time ?? MIN_TIME;
  return {
    targetId: target?.id, targetName: target?.name, kind: target?.kind,
    settings: target?.settings ?? DEFAULT_SETTINGS,
    loaded: session.loaded, saveError: session.saveError,
    update: (settings: typeof DEFAULT_SETTINGS) => { if (target) session.updateInstanceSettings(target.id, settings); },
    result: calculation?.result, status: calculation?.status ?? 'loading',
    retry: calculation?.retry ?? (() => {}),
    time, origin: target?.origin ?? time, datetime: new Date(time).toISOString(),
    unit: target?.unit ?? 2, selectUnit: session.selectUnit,
    step: session.step, reset: session.reset,
    canStepBackward: session.loaded && enabled && !!target && time > MIN_TIME,
    canStepForward: session.loaded && enabled && !!target && time < MAX_TIME,
  };
}
