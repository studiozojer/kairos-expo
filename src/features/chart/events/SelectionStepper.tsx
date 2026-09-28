import { useMemo } from 'react';
import type { ChartRenderingConfiguration } from '../config/ChartRenderingConfiguration';
import { useActiveCharts } from '../active/ActiveChartsContext';
import { useChartTime, ChartTimeProvider } from '../time/ChartTimeContext';
import { TimeStepper } from '../time/TimeStepper';
import { TimeStepperSurface } from '../time/TimeStepperSurface';
import { MIN_TIME, MAX_TIME } from '../time/timeSteps';
import { eventMode, supportsMode } from './mode';
import { useEventAvailability } from './useEventAvailability';
import { EventStepper } from './EventStepper';

/** Keep the original 56pt stepper footprint in both time and event modes.
 * The server's capability response gates event mode; Wi-Fi alone never does. */
export function SelectionStepper({ config, selectedIds, enabled, active }: {
  config?: ChartRenderingConfiguration; selectedIds: string[]; enabled: boolean; active: boolean;
}) {
  const session = useActiveCharts();
  const clock = useChartTime();
  const availability = useEventAvailability(active && session.loaded && !!session.targetId);
  const placements = config?.rings.flatMap(ring => ring.type.kind === 'planets' ? ring.type.placements : []) ?? [];
  // Negotiate the query subset so an older server can still step major aspects.
  const enabledAspects = (config?.aspects.enabledTypes ?? []).filter(aspect => availability.capabilities?.aspects.some(supported => supported === aspect));
  const mode = eventMode(placements, selectedIds, session.targetId, enabledAspects);
  const fixedIds = [...new Set(placements.filter(p => selectedIds.includes(p.id) && p.chartInstanceId !== session.targetId)
    .map(p => p.chartInstanceId).filter((id): id is string => !!id))];
  const fixedReady = fixedIds.every(id => session.calculations[id]?.status === 'ready');
  const capabilities = useMemo(() => availability.capabilities ? { ...availability.capabilities,
    supported_from: new Date(Math.max(MIN_TIME, Date.parse(availability.capabilities.supported_from))).toISOString(),
    supported_to: new Date(Math.min(MAX_TIME + 1, Date.parse(availability.capabilities.supported_to))).toISOString(),
  } : null, [availability.capabilities]);
  const supported = !!mode && !!capabilities && supportsMode(capabilities, mode, clock.time);
  const eventAvailable = active && supported && fixedReady && availability.status === 'available';
  const snapshot = { targetId: session.targetId ?? '', charts: session.active.filter(chart => chart.id === session.targetId || fixedIds.includes(chart.id)) };
  // Invalidate fixed-point requests even if a settings/time change happens to
  // produce the same longitude. Reordering alone leaves this key unchanged.
  const dependencyKey = JSON.stringify(snapshot.charts
    .map(chart => [chart.id, chart.id === session.targetId ? null : chart.time, chart.settings]).sort());
  return <TimeStepperSurface>
    {eventAvailable && mode && capabilities ? <EventStepper key={`${mode.key}:${dependencyKey}`}
      colors={config!.colors} aspectHues={config!.aspectOverlayStyle.aspectHues}
      mode={mode} capabilities={capabilities} time={clock.time} timezone={clock.settings.location.timezone}
      origin={clock.origin} kind={clock.kind ?? 'now'} enabled={enabled}
      onSeek={time => enabled && session.seek(snapshot, time)} onReset={clock.reset} onRequestFailure={availability.reportFailure} />
      : <ChartTimeProvider enabled={enabled}><TimeStepper key={session.targetId ?? 'empty'} /></ChartTimeProvider>}
  </TimeStepperSurface>;
}
