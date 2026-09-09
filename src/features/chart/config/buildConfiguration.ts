/**
 * buildConfiguration — build a solo-wheel ChartRenderingConfiguration from an
 * engine chart response + a parsed preset.
 *
 * Faithful port of kairos-ios `PresetConfigurationBuilder.buildConfiguration`
 * (Features/Presets/Utilities/PresetConfigurationBuilder.swift, single-chart
 * overload) onto the TS schema types. Per-item provenance is noted inline;
 * the verified answers the plan asked for:
 *
 *  - VISIBILITY: `enabledBodies` on the wire are DISPLAY names ("North Node",
 *    "Sun"); placements resolve to enums.gen ids. iOS decodes the list into
 *    `Set<CelestialBody>` and compares enum identity; here each entry is
 *    normalized to an enums.gen id — exact key, or displayName inverse
 *    (case-insensitive). Unknown entries are DROPPED per-entry (Swift's `try?`
 *    drops the WHOLE blob to `.minimal` on an unknown raw value; the per-entry
 *    drop is the deliberate tolerance divergence, same policy as the schema
 *    layer). EMPTY set = Swift's `.minimal` = NOTHING passes (the
 *    `ringBodies.contains(body)` guard fails for every body; the emptied
 *    planets ring is then dropped). Verified at PresetConfigurationBuilder
 *    .swift:144-160 + VisibilityConfiguration.swift:30-32. All seven bundled
 *    templates ship non-empty lists, so the empty case is hand-built only.
 *  - NORTH NODE DEDUP runs at Placement-construction time, BEFORE the ring
 *    filters (Swift :109 vs :153). Kept-first in engine node order.
 *  - `showFrameDerivedPoints` is a SECOND, per-ring filter applied after
 *    visibility (Swift :149-157); the frame-derived SET is angles + Arabic
 *    lots + vertex (CelestialBody.isFrameDerivedPoint).
 *  - RING ORDER: the slot's `rings` array is OUTERMOST-FIRST (iOS renders
 *    config.rings[0] at the outer radius; the multi-chart builder maps the
 *    LAST planets ring to chart 1). Preserved as-is.
 *  - houseNumbers STYLE: iOS stores `.houseNumbers(style.modules.zodiacRing)`
 *    (a ZodiacRingStyle!) but `HouseNumbersRing.render` never reads the ring
 *    payload — it reads `style.modules.houses`. The HousesRingStyle fields
 *    (rotateNumbers, numberFontSize, …) ARE used, just sourced from the
 *    ChartStyle module, not the ring config. This port carries the ring's own
 *    parsed HousesRingStyle so the fields travel with the ring.
 *  - ASPECTS: `aspectEdges` pass through RAW; enabled/type/orb filtering lives
 *    in the render overlay (AspectOverlay.swift → AspectFilterResult.evaluate).
 *    iOS's builder does an endpoint-visibility pre-filter for its overlay
 *    payload; the overlay re-derives the same set from the pre-filtered
 *    placements it receives, so nothing is lost by deferring it to render.
 *    `aspectOverlayStyle` (Task 10) carries `preset.aspectOverlay` straight
 *    through for the same reason — its line width/color mode/hues/cap are
 *    render-time concerns, not builder concerns.
 */

import { CELESTIAL_BODIES, type CelestialBodyId } from "../schema/enums.gen";
import type { Preset } from "../schema/preset";
import type { RingModule } from "../schema/ring-module";
import {
  PLANETS_STYLE_TYPE,
  defaultRingStyle,
  type PlanetsRingStyle,
  type RingStyle,
} from "../schema/ring-styles";
import type { ChartRenderingConfiguration, RingConfiguration } from "./ChartRenderingConfiguration";
import {
  FRAME_DERIVED_POINT_IDS,
  deduplicateNorthNode,
  placementFromNode,
  type ChartCalculationResponse,
  type Placement,
} from "./engine-types";

/**
 * Normalize one `enabledBodies` entry to an enums.gen id: an exact key passes
 * through ("sun"); otherwise a case-insensitive displayName inverse lookup
 * ("North Node" → "rahu"). Unknown → undefined (dropped tolerantly).
 */
function normalizeEnabledBody(entry: string): CelestialBodyId | undefined {
  if (Object.prototype.hasOwnProperty.call(CELESTIAL_BODIES, entry)) return entry;
  const lower = entry.toLowerCase();
  for (const [key, info] of Object.entries(CELESTIAL_BODIES)) {
    if (info.displayName.toLowerCase() === lower) return key;
  }
  return undefined;
}

/**
 * The `[windowLo, windowHi]` displacement window for a placement — its own
 * house when houses are enabled and it carries a house, else its sign. This
 * is the bound the windowed PAV displacement respects (the "own house /
 * sign" guarantee). Window values are zodiac degrees; `windowHi` may exceed
 * 360 when a house wraps the 0° line.
 */
function windowForPlacement(
  placement: Placement,
  houseCusps: number[],
  housesEnabled: boolean,
): { windowLo: number; windowHi: number } {
  const h = placement.housePlacement;
  if (housesEnabled && h >= 1 && h <= 12) {
    const lo = houseCusps[h - 1];
    let hi = houseCusps[h % 12];
    if (hi <= lo) hi += 360;
    return { windowLo: lo, windowHi: hi };
  }
  const lo = Math.floor(placement.longitude / 30) * 30;
  return { windowLo: lo, windowHi: lo + 30 };
}

/** The ring's PlanetsRingStyle if it carries one, else the static default. */
function planetsStyleOf(ring: RingModule): PlanetsRingStyle {
  return ring.style.$type === PLANETS_STYLE_TYPE
    ? ring.style
    : (defaultRingStyle("planets") as PlanetsRingStyle);
}

/**
 * Solo slot only (`preset.soloChart`). Enabled rings in slot order,
 * outermost-first. A planets ring whose visibility filters leave zero
 * placements is dropped entirely (Swift :160 `if !filteredPlacements.isEmpty`).
 */
export function buildConfiguration(
  chart: ChartCalculationResponse,
  preset: Preset,
): ChartRenderingConfiguration {
  // Houses: sort by house_number (the graph's node order is insertion order;
  // Swift sorts explicitly — PresetConfigurationBuilder :93).
  const sortedHouses = [...chart.houses.nodes].sort((a, b) => a.house_number - b.house_number);
  const houseCusps = sortedHouses.map((h) => h.cusp_longitude);
  const orientation = sortedHouses[0]?.cusp_longitude ?? 0.0;

  // Houses are "on" iff the preset has an enabled houses ring — the signal
  // the windowed displacement uses to choose house-bound vs sign-bound.
  const housesEnabled = preset.soloChart.rings.some((r) => r.type === "houses" && r.enabled);

  // Placements + North-Node dedup BEFORE any ring filter (Swift :109).
  const placements = deduplicateNorthNode(chart.celestial.nodes.map(placementFromNode));

  // Preset-wide visibility, normalized to id space once.
  const enabledBodies = new Set(
    preset.visibility.enabledBodies
      .map(normalizeEnabledBody)
      .filter((id): id is CelestialBodyId => id !== undefined),
  );

  const rings: RingConfiguration[] = [];
  for (const ringModule of preset.soloChart.rings) {
    if (!ringModule.enabled) continue;

    switch (ringModule.type) {
      case "zodiac":
        rings.push({
          type: { kind: "zodiacSigns" },
          style: ringModule.style,
          thickness: ringModule.thickness,
        });
        break;

      case "planets": {
        const style = planetsStyleOf(ringModule);
        const filtered: Placement[] = placements.filter((p) => {
          if (!enabledBodies.has(p.bodyId)) return false;
          if (!style.showFrameDerivedPoints && FRAME_DERIVED_POINT_IDS.has(p.bodyId)) return false;
          return true;
        });
        if (filtered.length > 0) {
          rings.push({
            type: {
              kind: "planets",
              // Displacement window per placement (house, else sign) — see
              // windowed PAV (PlanetLayoutEngine). Applied here so the solver
              // stays pure and the coordinator needs no cusp knowledge.
              placements: filtered.map((p) => ({ ...p, ...windowForPlacement(p, houseCusps, housesEnabled) })),
              ringNumber: 1,
              maxRingNumber: 1,
              drawInnerBoundary: false,
            },
            style,
            thickness: ringModule.thickness,
          });
        }
        break;
      }

      case "houses":
        rings.push({
          type: { kind: "houseNumbers" },
          // See the houseNumbers note in ChartRenderingConfiguration.ts: iOS
          // packs a ZodiacRingStyle here that its renderer never reads; we
          // carry the ring's own HousesRingStyle (rotateNumbers & co.) so the
          // values that actually drive HouseNumbersRing travel with the ring.
          style: ringModule.style,
          thickness: ringModule.thickness,
        });
        break;

      case "cuspAnnotations":
        rings.push({
          type: { kind: "cuspAnnotations" },
          style: ringModule.style,
          thickness: ringModule.thickness,
        });
        break;

      case "aspects":
        // Aspect overlays are not rings (Swift `continue`); the config carries
        // aspects + aspectEdges as top-level fields instead.
        break;

      default:
        // decans / signRulers / terms / lunarMansions / fixedStars parse in
        // the schema layer but don't render yet (Task 8+ territory).
        console.warn(
          `[buildConfiguration] ring type "${ringModule.type}" is not rendered yet; skipping`,
        );
    }
  }

  return {
    rings,
    houseCusps,
    orientation,
    aspects: preset.aspects,
    aspectEdges: chart.celestial.edges,
    // Task 10: threaded through so the render-layer overlay has its style
    // (Task 7 carried aspects/aspectEdges but dropped this — see the field's
    // doc comment on ChartRenderingConfiguration).
    aspectOverlayStyle: preset.aspectOverlay,
    colors: preset.colors,
    globalSettings: preset.soloChart.globalSettings,
  };
}
