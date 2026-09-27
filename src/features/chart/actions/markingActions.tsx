import { MarkingIcon } from '../marking/MarkingIcon';
import type { MarkingMenuOption } from '../marking/MarkingMenu';
import { DIRECTIONS, type MarkingDirection } from '../marking/markingMenuState';
import { isActionId, type ActionId } from './actionRegistry';
import type { ChartActions } from './useActionRegistry';

/** Slot data is serializable; execution resolves against live state on release.
 * Unknown IDs are omitted so a future removed action cannot crash a menu. */
export type ActionSlots = Partial<Record<MarkingDirection, ActionId>>;
export function markingActions(slots: ActionSlots, actions: ChartActions, color: string): MarkingMenuOption[] {
  return DIRECTIONS.flatMap(position => {
    const id = slots[position];
    if (!id || !isActionId(id)) return [];
    const action = actions.describe(id);
    return [{ id: `${position}:${id}`, position, label: action.label,
      icon: <MarkingIcon name={action.icon} color={color} />, disabled: !action.enabled,
      onSelect: () => actions.invoke(id) }];
  });
}
