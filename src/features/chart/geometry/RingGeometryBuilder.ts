/**
 * RingGeometryBuilder — ring thickness calculation for chart wheel rendering.
 *
 * Mirrors kairos-ios `.../Viewing/Builders/RingGeometryBuilder.swift` (:19-77),
 * a pure function extracted from ChartWheelRenderer for testability. Handles:
 *  - fixed vs auto-sized rings from the ring's `RingThickness`
 *  - distribution of remaining space among auto-sized rings
 *  - minimum-thickness clamping (5pt) to prevent rendering issues
 *
 * The Swift `debugInfo` helper is DEBUG-only logging and is not ported.
 *
 * Parity gate: `__tests__/RingGeometryBuilder.test.ts` translates
 * RingGeometryBuilderTests.swift case-for-case with its hand-computed
 * expected values intact.
 */

import type { GlobalChartVariables, RingThickness } from "../schema/core-types";
import type { RingModule } from "../schema/ring-module";

/**
 * The calculation reads only `thickness` from each ring. Structural typing:
 * Task 7's `RingConfiguration` (type + style + thickness) is assignable
 * here unchanged, as are the schema's wire-level `RingModule`s.
 */
export type RingThicknessInput = { thickness: RingThickness };

export class RingGeometryBuilder {
  /** Minimum thickness for any ring to prevent rendering issues. */
  private static readonly minimumRingThickness = 5;

  /**
   * Calculate ring thicknesses for all rings in the configuration.
   *
   * @param chartSize  The overall chart size in points
   * @param rings      The ring configurations to render (with thickness info)
   * @param ringModules Legacy parameter — no longer used (thickness comes
   *                    from the ring configuration), kept for Swift
   *                    signature parity
   * @param globalStyle Global chart style variables (margin, gap, inner radius)
   * @returns Calculated thicknesses (in points) matching the rings array order
   */
  static calculateRingThicknesses(
    chartSize: number,
    rings: readonly RingThicknessInput[],
    ringModules: readonly RingModule[],
    globalStyle: GlobalChartVariables,
  ): number[] {
    const ringCount = rings.length;
    const availableRadius = chartSize / 2 - globalStyle.margin;
    const totalGaps = (ringCount - 1) * globalStyle.ringGap;

    // Total space available for ALL rings (excluding inner radius and gaps)
    const totalAvailableSpace = availableRadius - globalStyle.minimumInnerRadius - totalGaps;

    // Calculate space needed for fixed rings and count auto-sized rings
    let spaceForFixedRings = 0;
    let autoSizedRingCount = 0;

    for (const ringConfig of rings) {
      switch (ringConfig.thickness.kind) {
        case "auto":
          autoSizedRingCount += 1;
          break;
        case "fixed":
          spaceForFixedRings += ringConfig.thickness.value;
          break;
      }
    }

    // Calculate thickness for auto-sized rings
    const spaceForAutoRings = totalAvailableSpace - spaceForFixedRings;
    // Clamp auto ring thickness to minimum to prevent negative/tiny rings
    const rawAutoRingThickness =
      autoSizedRingCount > 0 ? spaceForAutoRings / autoSizedRingCount : 0;
    const autoRingThickness = Math.max(
      rawAutoRingThickness,
      RingGeometryBuilder.minimumRingThickness,
    );

    // Build thickness array based on ring configurations
    const ringThicknesses: number[] = [];
    for (const ringConfig of rings) {
      switch (ringConfig.thickness.kind) {
        case "auto":
          ringThicknesses.push(autoRingThickness);
          break;
        case "fixed":
          // Clamp fixed thickness to minimum as well
          ringThicknesses.push(
            Math.max(ringConfig.thickness.value, RingGeometryBuilder.minimumRingThickness),
          );
          break;
      }
    }

    return ringThicknesses;
  }
}
