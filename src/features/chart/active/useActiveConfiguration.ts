import { useMemo, useState } from 'react';
import { buildMultiConfiguration } from '../config/buildConfiguration';
import type { Preset } from '../schema/preset';
import type { ActiveChart } from './model';
import type { ActiveCalculation } from './ActiveChartsContext';

/** Geometry changes only when ordered identities, labels, calculated charts or
 * display preferences change. Target/unit/persistence updates do not rebuild it. */
export function useActiveConfiguration(active: ActiveChart[], calculations: Record<string, ActiveCalculation>, preset: Preset) {
  const [a, b, c] = active;
  const first = a && calculations[a.id]?.result?.chart;
  const second = b && calculations[b.id]?.result?.chart;
  const third = c && calculations[c.id]?.result?.chart;
  const config = useMemo(() => {
    if (!a || !first || (b && !second) || (c && !third)) return undefined;
    return buildMultiConfiguration([
      { instanceId: a.id, name: a.name, chart: first },
      ...(b && second ? [{ instanceId: b.id, name: b.name, chart: second }] : []),
      ...(c && third ? [{ instanceId: c.id, name: c.name, chart: third }] : []),
    ], preset);
    // Only these projected identity fields are consumed, not instance time or settings.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a?.id, a?.name, b?.id, b?.name, c?.id, c?.name, first, second, third, preset]);
  const [lastComplete, setLastComplete] = useState(config);
  if (config && config !== lastComplete) setLastComplete(config);
  if (!a && lastComplete) setLastComplete(undefined);
  return { config: config ?? (a ? lastComplete : undefined), previousArrangement: !!a && !config && !!lastComplete };
}
