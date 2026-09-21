/**
 * ChartRenderingConfiguration — the render-ready configuration consumed by the
 * chart wheel renderer (Task 8+). Everything pre-filtered, pre-resolved, pure
 * data. Mirrors kairos-ios `Features/ChartWheel/Viewing/Configuration/
 * ChartRenderingConfiguration.swift`. Active instances carry stable ownership
 * separately from ring order and engine calculation IDs.
 *
 * Ring order: OUTERMOST FIRST — iOS `RingGeometry` assigns index 0 the outer
 * radius (ChartGeometry.swift: "Outermost (index 0)"), and the builders append
 * in preset slot order, so the preset's `soloChart.rings` array is already
 * outermost→innermost (classic: zodiac → planets → houses). This module
 * preserves that order untouched. (Two stale comments claim otherwise —
 * KairosCore `RingModuleEntity.swift`/`ChartConfigEntity.swift` say "innermost
 * = 0", and EXPO's schema/{preset,ring-module}.ts repeated them; the renderer
 * + both builders + the fixtures all say outermost-first.)
 */

import type { RingThickness } from "../schema/core-types";
import type { ChartColors, GlobalChartVariables } from "../schema/core-types";
import type { AspectConfiguration } from "../schema/preset";
import type { AspectOverlayStyle, RingStyle } from "../schema/ring-styles";
import type { AspectEdgeDTO, Placement } from "./engine-types";

/** The type of content in a ring (mirrors iOS `RingContentType`). */
export type RingContentType =
  | { kind: "zodiacSigns" }
  | {
      kind: "planets";
      /** Pre-filtered by preset visibility (+ per-ring showFrameDerivedPoints). */
      placements: Placement[];
      /** Chart position (1..maxRingNumber), innermost first. Not stable identity. */
      ringNumber: number;
      maxRingNumber: number;
      drawInnerBoundary: boolean;
    }
  | { kind: "houseNumbers" }
  | { kind: "cuspAnnotations" }
  | { kind: "empty" };

/** One ring with pre-filtered content and pre-resolved style. */
export interface RingConfiguration {
  /** Owner of this ring's house frame; zodiac rings are shared. */
  chartInstanceId?: string;
  chartName?: string;
  houseCusps?: number[];
  type: RingContentType;
  /**
   * The ring's style. Mirrors iOS `RingStyleVariant` resolution per kind:
   * zodiacSigns → ZodiacRingStyle, planets → PlanetsRingStyle,
   * cuspAnnotations → CuspAnnotationsStyle. houseNumbers: iOS carries a
   * ZODIAC style here (`RingStyleVariant.houseNumbers(style.modules.zodiacRing)`)
   * but the render path never reads it — `HouseNumbersRing` reads
   * `style.modules.houses` (rotateNumbers, numberFontSize) instead. This port
   * carries the ring's own parsed HousesRingStyle so those fields actually
   * reach the renderer (see buildConfiguration.ts).
   */
  style: RingStyle;
  thickness: RingThickness;
}

export interface ChartRenderingConfiguration {
  /** Number of active chart instances, independent of visible body count. */
  chartCount?: number;
  referenceInstanceId?: string;
  /** Outermost → innermost (see module header). */
  rings: RingConfiguration[];
  /** 12 cusp longitudes, house 1 first (sorted by house_number). */
  houseCusps: number[];
  /** Preset static orientation: longitude placed at the left edge, degrees. */
  orientation: number;
  /** The preset's aspect config — applied at RENDER time by the overlay. */
  aspects: AspectConfiguration;
  /**
   * Engine intra-chart edges plus locally calculated cross-chart edges.
   * Active endpoints are instance-qualified; preview endpoints remain raw. iOS applies
   * AspectConfiguration enabled/type/orb filtering at render time
   * (AspectOverlay.swift → AspectFilterResult.evaluate), not in the builder —
   * and the builder stays free of it here too.
   */
  aspectEdges: AspectEdgeDTO[];
  /**
   * The preset's `aspectOverlay` field (Task 10) — line width, color mode,
   * bezier curve strength, per-type hues, `maximumAspectCount`, etc. Applied
   * at render time by `AspectOverlay.tsx`, same deferral as `aspects` above.
   * Not threaded through as a ring: Swift's `AspectOverlay` is a
   * `ChartOverlay`, not a `SelectionAwareChartRing` — this mirrors that by
   * keeping it a top-level config field rather than a `RingConfiguration`
   * (buildConfiguration.ts's `case "aspects"` deliberately drops that ring's
   * own style, matching Swift's `continue`).
   */
  aspectOverlayStyle: AspectOverlayStyle;
  colors: ChartColors;
  globalSettings: GlobalChartVariables;
}
