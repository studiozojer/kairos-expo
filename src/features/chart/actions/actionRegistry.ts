import type { MarkingIconName } from '../marking/iconNames';

export const ACTIONS = {
  'orientation.left': { label: 'Rotate left', hint: 'Locks orientation and moves one zodiac sign left.', icon: 'rotateLeft', category: 'orientation' },
  'orientation.right': { label: 'Rotate right', hint: 'Locks orientation and moves one zodiac sign right.', icon: 'rotateRight', category: 'orientation' },
  'orientation.reset': { label: 'Reset orientation', hint: 'Restores the preset’s fixed orientation without changing lock mode.', icon: 'reset', category: 'orientation' },
  'chart.library': { label: 'Add / saved charts', hint: 'Opens saved charts. Hold and drag down to add a Now chart.', icon: 'add', category: 'chart' },
  'chart.addNow': { label: 'Now', hint: 'Adds a chart for the current time.', icon: 'now', category: 'chart' },
  'chart.settings': { label: 'Chart settings', hint: 'Opens calculation settings for the selected chart.', icon: 'settings', category: 'chart' },
  'orientation.toggle': { label: 'Lock chart', hint: 'Switches between fixed and Ascendant orientation.', icon: 'lock', category: 'orientation' },
  'chart.screenshot': { label: 'Screenshot', hint: 'Captures this chart page for sharing.', icon: 'screenshot', category: 'screenshot' },
  'display.settings': { label: 'Display settings', hint: 'Opens chart display options.', icon: 'display', category: 'display' },
  'display.aspects': { label: 'Aspect lines', hint: 'Shows or hides aspect lines and patterns.', icon: 'display', category: 'display' },
  'display.patterns': { label: 'Aspect patterns', hint: 'Shows or hides aspect pattern fills.', icon: 'display', category: 'display' },
  'display.falseAspects': { label: 'False aspects', hint: 'Includes or excludes out-of-sign aspects and patterns.', icon: 'display', category: 'display' },
  'time.backward': { label: 'Step backward', hint: 'Steps the selected chart back by its chosen interval.', icon: 'backward', category: 'time' },
  'time.forward': { label: 'Step forward', hint: 'Steps the selected chart forward by its chosen interval.', icon: 'forward', category: 'time' },
  'time.reset': { label: 'Reset time', hint: 'Restores the selected chart’s original time, or now for current transits.', icon: 'reset', category: 'time' },
} as const satisfies Record<string, { label: string; hint: string; icon: MarkingIconName; category: string }>;
export type ActionId = keyof typeof ACTIONS;
export type DisplayToggle = 'enabled' | 'showPatterns' | 'showFalseAspects';
export const ACTION_IDS = Object.keys(ACTIONS) as ActionId[];
export function isActionId(id: string): id is ActionId { return Object.hasOwn(ACTIONS, id); }
export interface ActionContext {
  enabled: boolean; settingsEnabled: boolean; chartEnabled: boolean; capturing: boolean; locked: boolean;
  chartsLoaded: boolean; openLibrary: () => void; addNow: () => void;
  hasTarget: boolean; targetKind?: 'saved' | 'now' | 'snapshot'; canStepBackward: boolean; canStepForward: boolean;
  aspects: { enabled: boolean; showPatterns: boolean; showFalseAspects: boolean };
  openSettings: () => void; openDisplay: () => void; toggleOrientation: () => void;
  rotateOrientation: (direction: -1 | 1) => void; resetOrientation: () => void;
  screenshot: () => void | Promise<void>;
  toggleDisplay: (key: DisplayToggle) => void;
  step: (direction: -1 | 1) => void; reset: () => void;
}
export interface ActionPresentation {
  id: ActionId; label: string; hint: string; icon: MarkingIconName;
  category: string; enabled: boolean; selected?: boolean; busy: boolean;
}
export type ActionResult = { status: 'executed' | 'unavailable' | 'busy' | 'unknown' } | { status: 'failed'; error: unknown };
const displayKeys = { 'display.aspects': 'enabled', 'display.patterns': 'showPatterns', 'display.falseAspects': 'showFalseAspects' } as const;

/** Per-screen executor. Descriptions and invocation both read current state;
 * menu closures store IDs, never a target chart or an old permission snapshot. */
export function createActionRegistry(getContext: () => ActionContext, changed: () => void = () => {}) {
  const pending = new Set<ActionId>();
  function describe(id: ActionId): ActionPresentation {
    const c = getContext();
    let enabled = c.chartEnabled;
    let label: string = ACTIONS[id].label;
    let icon: MarkingIconName = ACTIONS[id].icon;
    let selected: boolean | undefined;
    switch (id) {
      case 'chart.library': enabled = true; break;
      case 'chart.addNow': enabled = c.chartsLoaded; break;
      case 'chart.settings': enabled = c.settingsEnabled; break;
      case 'chart.screenshot': if (c.capturing || pending.has(id)) label = 'Capturing chart'; break;
      case 'orientation.toggle': selected = c.locked; label = c.locked ? 'Unlock chart' : 'Lock chart'; icon = c.locked ? 'lock' : 'unlock'; break;
      case 'time.backward': enabled = c.hasTarget && c.canStepBackward; break;
      case 'time.forward': enabled = c.hasTarget && c.canStepForward; break;
      case 'time.reset': enabled = c.hasTarget; label = c.targetKind === 'saved' ? 'Return to original time' : 'Return to now'; break;
      case 'display.aspects': case 'display.patterns': case 'display.falseAspects': selected = c.aspects[displayKeys[id]]; break;
    }
    return { ...ACTIONS[id], id, label, icon, selected, busy: pending.has(id), enabled: enabled && c.enabled && !c.capturing && !pending.has('chart.screenshot') && !pending.has(id) };
  }
  async function execute(id: string): Promise<ActionResult> {
    if (!isActionId(id)) return { status: 'unknown' };
    if (pending.has(id)) return { status: 'busy' };
    if (!describe(id).enabled) return { status: 'unavailable' };
    const c = getContext();
    pending.add(id); changed();
    try {
      switch (id) {
        case 'chart.library': c.openLibrary(); break;
        case 'chart.addNow': c.addNow(); break;
        case 'chart.settings': c.openSettings(); break;
        case 'display.settings': c.openDisplay(); break;
        case 'orientation.left': c.rotateOrientation(-1); break;
        case 'orientation.right': c.rotateOrientation(1); break;
        case 'orientation.reset': c.resetOrientation(); break;
        case 'orientation.toggle': c.toggleOrientation(); break;
        case 'chart.screenshot': await c.screenshot(); break;
        case 'display.aspects': case 'display.patterns': case 'display.falseAspects': c.toggleDisplay(displayKeys[id]); break;
        case 'time.backward': c.step(-1); break;
        case 'time.forward': c.step(1); break;
        case 'time.reset': c.reset(); break;
      }
      return { status: 'executed' };
    } catch (error) {
      return { status: 'failed', error };
    } finally { pending.delete(id); changed(); }
  }
  return { describe, execute, list: () => ACTION_IDS.map(describe) };
}
export type ActionRegistry = ReturnType<typeof createActionRegistry>;
