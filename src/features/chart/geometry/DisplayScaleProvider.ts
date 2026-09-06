/**
 * DisplayScaleProvider — display scale factor for different screen sizes.
 *
 * Mirrors kairos-ios `Core/Utilities/DisplayScaleProvider.swift`. Profile
 * values are designed for a ~400pt iPhone canvas; larger screens scale up
 * along a **damped power curve** so elements grow but preserve breathing
 * room:
 *
 * ```
 * scale = clamp((canvasSize / 400) ^ 0.75, 0.1, 2.5)
 * ```
 *
 * Example factors (from the Swift header): iPhone 14 (390pt) ≈ 0.98×,
 * iPad Pro 12.9" (950pt) ≈ 1.93×.
 *
 * Naming note: Swift's `scaleFactor(for:)` is named `scale(canvasSize)` here
 * per the Task 5 plan interface. Swift's `scale(_:for:)` value helpers are
 * not ported — callers multiply by the factor directly (see
 * ChartConfigurationScaler).
 */
export class DisplayScaleProvider {
  /** Reference canvas size (iPhone-sized). Profile values are designed for this size. */
  static readonly referenceSize = 400.0;

  /**
   * Damping exponent for the power curve: 1.0 = linear, 0.75 = damped
   * (iPad elements grow but preserve breathing room), 0.5 = heavily damped.
   */
  static readonly dampingExponent = 0.75;

  /** Maximum scale factor — prevents excessively large elements. */
  static readonly maxScale = 2.5;

  /** Minimum scale factor — prevents tiny elements on small screens. */
  static readonly minScale = 0.1;

  /**
   * Scale factor for a given canvas size, on the damped power curve.
   *
   * @param canvasSize The width of the chart canvas in points
   * @returns Scale factor to apply to all sizing values
   */
  static scale(canvasSize: number): number {
    const ratio = canvasSize / DisplayScaleProvider.referenceSize;
    const damped = ratio ** DisplayScaleProvider.dampingExponent;
    return Math.min(Math.max(damped, DisplayScaleProvider.minScale), DisplayScaleProvider.maxScale);
  }
}
