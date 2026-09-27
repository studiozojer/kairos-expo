import { useLayoutEffect, useState } from 'react';
import { Alert } from 'react-native';
import { createActionRegistry, type ActionContext, type ActionId } from './actionRegistry';

export function useActionRegistry(context: ActionContext) {
  const [, refresh] = useState(0);
  const [runtime] = useState(() => {
    let committed = context;
    let active = false;
    return {
      registry: createActionRegistry(() => ({ ...committed, enabled: active && committed.enabled }), () => {
        if (active) refresh(n => n + 1);
      }),
      commit: (next: ActionContext) => { committed = next; active = true; },
      deactivate: () => { active = false; },
      isActive: () => active,
    };
  });
  useLayoutEffect(() => { runtime.commit(context); });
  useLayoutEffect(() => () => runtime.deactivate(), [runtime]);
  // Render from this render's context; callbacks use committed context only.
  const presentation = createActionRegistry(() => context);
  const describe = (id: ActionId) => {
    const next = presentation.describe(id);
    const running = runtime.registry.describe(id);
    return { ...next, busy: running.busy,
      enabled: next.enabled && !runtime.registry.describe('chart.screenshot').busy && !running.busy,
      label: running.busy ? running.label : next.label };
  };
  const invoke = (id: ActionId) => { void runtime.registry.execute(id).then(result => {
    if (runtime.isActive() && result.status === 'failed') Alert.alert('Action failed', 'Please try again.');
  }); };
  return { describe, invoke };
}
export type ChartActions = ReturnType<typeof useActionRegistry>;
