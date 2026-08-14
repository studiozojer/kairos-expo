/**
 * DegreeTextStack — stack geometry for degree text, zodiac sign glyph, minute
 * text, and retrograde glyph (the non-drawing half of kairos-ios
 * `.../Viewing/Wheel/Rendering/DegreeTextRenderer.swift`).
 *
 * Elements are positioned outward from the planet glyph/circle along the
 * stack's radial direction, with dynamic spacing. Hidden elements cause
 * subsequent elements to "bump up" closer to the planet glyph.
 *
 * Spacing uses top-padding approach: `degreeTextLineSpacing` is the gap
 * between elements, calculated as:
 *   previousElementSize/2 + padding + currentElementSize/2
 *
 * **Single source of truth for stack geometry** (Swift :47-52): both the
 * renderer (Task 9, draws each element at `position ± unit · centerOffset`)
 * and `stackTailOffset` (last element's `centerOffset`, feeding the
 * connection-line endpoint) consume `stackElements` — so the geometry cannot
 * drift between drawing and endpoint computation.
 */

import type { PlanetsRingStyle } from "../schema/ring-styles";

/** One visible element in the degree-text stack. */
export interface StackElement {
  kind: "degrees" | "sign" | "minutes" | "retrograde";
  /**
   * Distance from the planet center to this element's center. Always
   * positive — magnitude only; the caller applies the radial direction.
   */
  centerOffset: number;
  /** Render size: font size for text elements, glyph size for SVG glyphs. */
  size: number;
}

/** Swift `DegreeTextRenderer.LastElement` — `.none` doubles as the retrograde target. */
type LastElement = "none" | "degrees" | "sign" | "minutes";

export class DegreeTextStack {
  /** Glyphs render at text size multiplied by this factor for better visibility */
  static readonly glyphSizeMultiplier = 1.4;

  /** Proportional spacing adjustments (relative to font size) */
  /** Extra spacing after degrees before sign glyph */
  static readonly degreesToSignSpacingMultiplier = 0.05;
  /** Extra spacing after sign before minutes */
  static readonly signToMinutesSpacingMultiplier = 0.0;
  /** Spacing after minutes before retrograde */
  static readonly minutesToRetrogradeSpacingMultiplier = 0.1;

  /**
   * Walks the visible stack once and returns each element's center offset and
   * render size, in draw order.
   *
   * The stack order is fixed — degrees → sign → minutes → retrograde — with
   * each element present only when its style flag (and, for retrograde, the
   * placement state) enables it. Returns `[]` when nothing is visible.
   *
   * Spacing uses the top-padding model: `degreeTextLineSpacing` is the base
   * gap between elements, adjusted proportionally per transition.
   *
   * (Swift `DegreeTextRenderer.stackElements` :56-123, structural port.)
   */
  static stackElements(style: PlanetsRingStyle, isRetrograde: boolean): StackElement[] {
    const degreesFontSize = style.degreeTextFontSize;
    const minutesFontSize = style.degreeTextFontSize * 0.8; // 80% of degrees size
    const signGlyphSize = style.degreeTextFontSize * DegreeTextStack.glyphSizeMultiplier;
    const rxGlyphSize = style.degreeTextFontSize;
    const planetGlyphSize = style.useGlyphs ? style.glyphSize : style.circleRadius * 2;

    // Track the current edge (bottom of the last placed element), starting
    // at the planet glyph's outer edge + base offset.
    let currentEdge = planetGlyphSize / 2 + style.degreeTextOffset;

    let lastElement: LastElement = "none";

    const baseSpacing = style.degreeTextLineSpacing;

    function spacingForTransition(from: LastElement, to: LastElement): number {
      // No spacing before the first element
      if (from === "none") return 0;
      let proportionalAdjustment: number;
      if (from === "degrees" && to === "sign") {
        proportionalAdjustment = degreesFontSize * DegreeTextStack.degreesToSignSpacingMultiplier;
      } else if ((from === "degrees" && to === "minutes") || (from === "sign" && to === "minutes")) {
        proportionalAdjustment = degreesFontSize * DegreeTextStack.signToMinutesSpacingMultiplier;
      } else {
        // (.minutes, _), (.degrees, _), (.sign, _) — retrograde passes to: .none
        proportionalAdjustment =
          degreesFontSize * DegreeTextStack.minutesToRetrogradeSpacingMultiplier;
      }
      return Math.max(0, baseSpacing + proportionalAdjustment);
    }

    const elements: StackElement[] = [];

    if (style.showDegreeText) {
      currentEdge += spacingForTransition(lastElement, "degrees");
      currentEdge += degreesFontSize / 2; // Move to center
      elements.push({ kind: "degrees", centerOffset: currentEdge, size: degreesFontSize });
      currentEdge += degreesFontSize / 2; // Move to bottom edge
      lastElement = "degrees";
    }
    if (style.showSignGlyph) {
      currentEdge += spacingForTransition(lastElement, "sign");
      currentEdge += signGlyphSize / 2; // Move to center
      elements.push({ kind: "sign", centerOffset: currentEdge, size: signGlyphSize });
      currentEdge += signGlyphSize / 2; // Move to bottom edge
      lastElement = "sign";
    }
    if (style.showMinuteText) {
      currentEdge += spacingForTransition(lastElement, "minutes");
      currentEdge += minutesFontSize / 2; // Move to center
      elements.push({ kind: "minutes", centerOffset: currentEdge, size: minutesFontSize });
      currentEdge += minutesFontSize / 2; // Move to bottom edge
      lastElement = "minutes";
    }
    if (style.showRetrogradeGlyph && isRetrograde) {
      currentEdge += spacingForTransition(lastElement, "none"); // "none" represents retrograde
      currentEdge += rxGlyphSize / 2; // Move to center
      elements.push({ kind: "retrograde", centerOffset: currentEdge, size: rxGlyphSize });
      // No further elements after rx — no need to advance currentEdge.
    }

    return elements;
  }

  /**
   * Returns the offset from planet center to the center of the **last**
   * visible stack element (degrees → sign → minutes → retrograde), walking
   * away from the planet center along the stack's radial direction. Returns
   * 0 when no stack elements are visible (caller should fall back to the
   * planet center as the endpoint).
   *
   * The visible set depends on `style` flags AND placement state (rx only
   * renders when both `showRetrogradeGlyph` and `isRetrograde`). Geometry is
   * shared with drawing via `stackElements` — this is just its last element's
   * `centerOffset`.
   *
   * (Swift `DegreeTextRenderer.stackTailOffset` :226-231.)
   */
  static stackTailOffset(style: PlanetsRingStyle, isRetrograde: boolean): number {
    const elements = DegreeTextStack.stackElements(style, isRetrograde);
    return elements.length > 0 ? elements[elements.length - 1].centerOffset : 0;
  }
}
