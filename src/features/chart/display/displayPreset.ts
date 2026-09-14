/**
 * Display-preset helpers — the pure, testable seam between the display sheet
 * and the wire `Preset`. Every control in the sheet mutates the preset through
 * one of these (immutably), and `buildConfiguration` turns the result back
 * into a render-ready chart. No schema changes: the controls edit the fields
 * that already exist on the wire (`RingModule.enabled`, `visibility
 * .enabledBodies`, `AspectConfiguration.enabled`).
 *
 * Deliberately in-memory for this slice — the athanor's fork (B) "chart-design
 * / visibility controls": prove the renderer + visibility wire-path against
 * real UI before persistence (a vault) or a native engine exist.
 *
 * Ring types here are the RENDERABLE subset only (zodiac, planets, houses,
 * cuspAnnotations). The other five ring kinds (decans, signRulers, terms,
 * lunarMansions, fixedStars) parse in the schema but have no renderer yet
 * (RING_RENDERERS falls through to a no-op), so a toggle for them would be a
 * switch that visibly does nothing — the exact "switchboard" the display-preset
 * direction note argues against.
 */

import type { Preset } from "../schema/preset";
import { placementFromNode, type ChartCalculationResponse } from "../config/engine-types";

/** Ring kinds with a registered renderer (ChartWheel.RING_RENDERERS). */
export const RENDERABLE_RING_TYPES = ["zodiac", "planets", "houses", "cuspAnnotations"] as const;

/** The renderable ring-kind union (a subset of the wire's `RingType`). */
export type RenderableRingType = (typeof RENDERABLE_RING_TYPES)[number];

/** Human label per ring type, for the sheet rows. */
export const RING_LABELS: Readonly<Record<RenderableRingType, string>> = {
  zodiac: "Zodiac",
  planets: "Planets",
  houses: "Houses",
  cuspAnnotations: "Cusp degrees",
};

/**
 * The ring types present in the preset's solo-chart slot, outermost-first,
 * restricted to the renderable set (see header). The order mirrors the wire
 * `rings` array so the sheet lays them out the way the wheel draws them.
 */
export function renderableRings(preset: Preset): RenderableRingType[] {
  return preset.soloChart.rings
    .filter((r) => (RENDERABLE_RING_TYPES as readonly string[]).includes(r.type))
    .map((r) => r.type as RenderableRingType);
}

/** Whether the preset has the given renderable ring enabled. */
export function isRingEnabled(preset: Preset, type: RenderableRingType): boolean {
  const ring = preset.soloChart.rings.find((r) => r.type === type);
  return ring?.enabled ?? false;
}

/**
 * Flip `enabled` on one solo-chart ring, immutably. A ring type absent from
 * the preset is a no-op (returns the preset unchanged) — there is nothing to
 * create yet (no ring reordering/re-adding in this slice).
 */
export function toggleRing(preset: Preset, type: RenderableRingType, enabled: boolean): Preset {
  let changed = false;
  const rings = preset.soloChart.rings.map((r) => {
    if (r.type !== type) return r;
    changed = true;
    return { ...r, enabled };
  });
  if (!changed) return preset;
  return { ...preset, soloChart: { ...preset.soloChart, rings } };
}

/** Toggle a celestial body (by canonical display name) in the visibility set. */
export function toggleBody(preset: Preset, displayName: string, enabled: boolean): Preset {
  const has = preset.visibility.enabledBodies.includes(displayName);
  if (enabled === has) return preset;
  const enabledBodies = enabled
    ? [...preset.visibility.enabledBodies, displayName]
    : preset.visibility.enabledBodies.filter((n) => n !== displayName);
  return { ...preset, visibility: { ...preset.visibility, enabledBodies } };
}

/** Whether the visibility set carries the given body display name. */
export function isBodyEnabled(preset: Preset, displayName: string): boolean {
  return preset.visibility.enabledBodies.includes(displayName);
}

/**
 * The bodies a chart actually has placements for, as canonical display names,
 * sorted. This is the honest toggle list: every entry toggles a body that is
 * on this sky, so no switch is inert. Bodies the preset's `enabledBodies`
 * names but the chart does not carry (e.g. Chiron in a Sibly chart) are
 * deliberately absent — they have no placement to show.
 *
 * Sorted by display name so the list is stable regardless of engine node
 * order; the wheel's own z-order is unaffected (visibility is a set).
 */
export function bodyChoices(chart: ChartCalculationResponse): string[] {
  const names = new Set<string>();
  for (const node of chart.celestial.nodes) {
    const placement = placementFromNode(node);
    names.add(placement.bodyName);
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}
