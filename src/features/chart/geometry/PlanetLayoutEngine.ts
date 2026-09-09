/**
 * PlanetLayoutEngine — collision-free angular layout for planets
 * (kairos-ios `.../Viewing/Layout/PlanetLayoutEngine.swift`, 469 lines).
 *
 * Implements a PAV (Pool Adjacent Violators) block layout algorithm to prevent
 * planet glyphs and degree text from overlapping when planets are positioned
 * close together.
 *
 * Algorithm Overview:
 * 1. Sort planets by zodiac longitude (wraparound-aware)
 * 2. Compute minimum angular separation from bbox + nudge
 * 3. Forward sweep building contiguous blocks (PAV / 1D isotonic regression)
 * 4. Place each block centered at the mean of its members' true longitudes
 *
 * Interface difference from Swift (per the Task 6 plan): the Swift struct is
 * stateful and returns CGPoint positions; the TS port is a pure static that
 * returns LONGITUDES (`LayoutPosition`). Point construction, degree-mark
 * positions, and connection endpoints are the caller's job — the two
 * endpoint helpers below are exported as pure functions with the exact Swift
 * signatures, and PlanetRingLayoutCoordinator ports the engine's
 * position-construction half verbatim.
 */

import type { PlanetsRingStyle } from "../schema/ring-styles";
import { DegreeTextStack } from "./DegreeTextStack";
import type { Point } from "./types";

// MARK: - Placement / layout types

/**
 * Minimal placement shape the chart geometry layer consumes (a structural
 * supertype of the engine's plan-mandated `{ id, longitude }` input — any
 * richer placement type satisfies it).
 *
 * Mirrors the subset of Swift's `Placement` the layout layer reads:
 * `id`, `longitude`, `isRetrograde`, and `celestialBody` (as `body`,
 * the engine-enum raw value, e.g. "sun"; optional — Swift treats a
 * non-body placement as always visible).
 */
export interface ChartPlacement {
  id: string;
  longitude: number;
  isRetrograde: boolean;
  /** Celestial-body name (Swift `Placement.celestialBody?.rawValue`); absent = always visible. */
  body?: string;
  /**
   * Displacement window (zodiac degrees) — own house (else sign), from
   * buildConfiguration. When present on every placement, the solver bounds
   * displacement to it (windowed PAV); absent → unbounded (legacy path).
   * `windowHi` may exceed 360 for a house wrapping the 0° line.
   */
  windowLo?: number;
  windowHi?: number;
}

/**
 * Swift `PlanetLayoutPosition` (PlanetLayoutEngine.swift :7-26) — a planet's
 * full layout position (original and adjusted), produced by
 * PlanetRingLayoutCoordinator.
 */
export interface PlanetLayoutPosition {
  placement: ChartPlacement;
  /** True zodiac position at mid-radius */
  originalPosition: Point;
  /** Collision-free position at mid-radius */
  adjustedPosition: Point;
  /** Position of the primary degree-mark tip (edge driven by style.anchorFromInnerEdge) */
  degreeMarkPosition: Point;
  /** Mirror-edge tick tip (opposite edge from primary); used when showConnectionOnBothEdges */
  degreeMarkMirrorPosition: Point;
  /**
   * Endpoint of the connection line on the planet's side (paired with
   * `degreeMarkPosition` on the tick's side). Under the anchor-tied semantic
   * (2026-05-31): equals the planet's adjusted position when
   * `invertGlyphOrder=false` (planet is at the anchor-side end of the
   * stack); equals the stack-tail position (last visible stack element on
   * the anchor side) when `invertGlyphOrder=true`, so the line terminates at
   * the readable content nearest the tick rather than crossing through the
   * stack.
   */
  connectionEndpoint: Point;
  /**
   * Endpoint on the planet's side for the MIRROR (opposite-edge) connection
   * line — the FAR-side end of the glyph stack (the opposite end from
   * `connectionEndpoint`): the planet glyph when `invertGlyphOrder=true`, or
   * the annotation stack tail when false.
   */
  farSideConnectionEndpoint: Point;
  /** Whether to draw line to degree mark */
  needsConnectionLine: boolean;
}

/** Task 6 plan interface: the engine's angular output, in input order. */
export interface LayoutPosition {
  id: string;
  trueLongitude: number;
  adjustedLongitude: number;
}

/**
 * Task 6 plan interface: the engine's configuration — mirrors the Swift
 * signature's parameters (glyph size / circle radius, padding, nudge
 * distance, radius).
 */
export interface PlanetLayoutConfig {
  /** Ring radius at which planet centers sit, in points (Swift `radius`). */
  radius: number;
  /** Additional spacing between planets in points (from preset overlapPrevention.nudgeDistance). */
  nudgeDistance: number;
  /** Swift `style.useGlyphs` — selects which size feeds the bbox. */
  useGlyphs: boolean;
  /** Swift `style.glyphSize` (used when useGlyphs). */
  glyphSize: number;
  /** Swift `style.circleRadius` (bbox side = circleRadius * 2 when !useGlyphs). */
  circleRadius: number;
  /**
   * Bbox padding in points. Swift HARDCODES 2.0
   * (`calculateBoundingBox`, PlanetLayoutEngine.swift :442); the plan lifts
   * it to a config parameter — omit to keep the Swift value.
   */
  padding?: number;
}

// MARK: - Connection-line endpoint geometry

/**
 * Computes the connection-line endpoint on the planet's side.
 * (Swift `PlanetLayoutPosition.computeConnectionEndpoint` :42-83.)
 *
 * Under the anchor-tied semantic (2026-05-31):
 * - **invertGlyphOrder=false** → planet is at the anchor-side end of the
 *   glyph stack → returns `planetPosition` (line ends at the planet glyph).
 * - **invertGlyphOrder=true** → planet is at the far-side end → returns
 *   the stack-tail position on the anchor side. The line terminates at the
 *   readable content nearest the tick rather than crossing through the stack.
 *
 * Falls back to `planetPosition` when no stack elements are visible
 * (nothing to terminate against).
 */
export function computeConnectionEndpoint(
  planetPosition: Point,
  chartCenter: Point,
  style: PlanetsRingStyle,
  isRetrograde: boolean,
): Point {
  // Under the anchor-tied semantic (2026-05-31):
  //   invertGlyphOrder=false → planet is at the anchor-side end of the
  //     stack → connection endpoint = planet center.
  //   invertGlyphOrder=true  → planet is at the far-side end → endpoint
  //     = stack tail on the anchor side (terminates at readable content
  //     nearest the tick rather than crossing through the stack).
  if (!style.invertGlyphOrder) {
    return planetPosition;
  }

  const tailOffset = DegreeTextStack.stackTailOffset(style, isRetrograde);
  if (tailOffset === 0) {
    return planetPosition; // No visible stack → fall back to planet glyph.
  }

  // Move from the planet (far-side end) back toward the anchor edge by
  // stackTailOffset to land on the stack's anchor-side end.
  //   anchor=inner → planet is outward → move inward → -radial → multiplier = -1
  //   anchor=outer → planet is inward  → move outward → +radial → multiplier = +1
  const dx = planetPosition.x - chartCenter.x;
  const dy = planetPosition.y - chartCenter.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance <= 0) return planetPosition;

  const directionMultiplier = style.anchorFromInnerEdge ? -1.0 : 1.0;
  const unitX = (directionMultiplier * dx) / distance;
  const unitY = (directionMultiplier * dy) / distance;

  return {
    x: planetPosition.x + unitX * tailOffset,
    y: planetPosition.y + unitY * tailOffset,
  };
}

/**
 * Computes the connection-line endpoint on the planet's side for the
 * MIRROR (opposite-edge) line — the FAR-side end of the glyph stack,
 * opposite to `computeConnectionEndpoint`.
 * (Swift `PlanetLayoutPosition.computeFarSideEndpoint` :95-131.)
 *
 * - **invertGlyphOrder=true** → the planet sits at the far-side end →
 *   returns `planetPosition`.
 * - **invertGlyphOrder=false** → the planet is at the anchor-side end →
 *   returns the annotation stack tail, offset AWAY from the anchor edge.
 *
 * Falls back to `planetPosition` when no stack elements are visible.
 */
export function computeFarSideEndpoint(
  planetPosition: Point,
  chartCenter: Point,
  style: PlanetsRingStyle,
  isRetrograde: boolean,
): Point {
  if (style.invertGlyphOrder) {
    return planetPosition; // Planet is the far-side end when inverted.
  }

  const tailOffset = DegreeTextStack.stackTailOffset(style, isRetrograde);
  if (tailOffset === 0) {
    return planetPosition; // No visible stack → fall back to planet glyph.
  }

  // Planet is at the anchor-side end; the far-side end is the annotation
  // tail, offset AWAY from the anchor edge (the mirror of
  // computeConnectionEndpoint's toward-anchor move).
  //   anchor=inner → move outward → +radial → multiplier = +1
  //   anchor=outer → move inward  → -radial → multiplier = -1
  const dx = planetPosition.x - chartCenter.x;
  const dy = planetPosition.y - chartCenter.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  if (distance <= 0) return planetPosition;

  const directionMultiplier = style.anchorFromInnerEdge ? 1.0 : -1.0;
  const unitX = (directionMultiplier * dx) / distance;
  const unitY = (directionMultiplier * dy) / distance;

  return {
    x: planetPosition.x + unitX * tailOffset,
    y: planetPosition.y + unitY * tailOffset,
  };
}

// MARK: - Planet Layout Engine

export class PlanetLayoutEngine {
  /**
   * Calculate collision-free layout positions for all planets.
   * Returns the adjusted longitudes in INPUT order (Swift un-sorts back to
   * original placement order and normalizes wraparound).
   *
   * (Swift `PlanetLayoutEngine.calculateNonOverlappingLayout` :161-245 —
   * the angular half; Swift's point/endpoint construction lives in
   * PlanetRingLayoutCoordinator here.)
   */
  static calculateNonOverlappingLayout(
    placements: { id: string; longitude: number; windowLo?: number; windowHi?: number }[],
    config: PlanetLayoutConfig,
  ): LayoutPosition[] {
    // Empty / single-planet trivial cases.
    if (placements.length <= 1) {
      return placements.map((p) => ({
        id: p.id,
        trueLongitude: p.longitude,
        adjustedLongitude: p.longitude,
      }));
    }

    const hasWindows = placements.every(
      (p) => p.windowLo !== undefined && p.windowHi !== undefined,
    );

    // 1. Sort by true longitude, unrolled at the largest empty arc (the seam
    //    never slices a tight cluster — see sortIndicesAtLargestGap), unrolling
    //    the displacement windows in lockstep when present.
    const { sortedIndices, unrolledLongitudes, unrolledLo, unrolledHi } =
      sortIndicesAtLargestGap(
        placements.map((p) => p.longitude),
        hasWindows ? placements.map((p) => p.windowLo as number) : undefined,
        hasWindows ? placements.map((p) => p.windowHi as number) : undefined,
      );

    // 2. Compute minimum angular separation from bbox + nudge.
    //    Bbox size is uniform across planets (same glyphSize/circleRadius for all),
    //    so we evaluate at any point.
    const bbox = boundingBoxSize(config);
    const minSepPoints = bbox + config.nudgeDistance;
    const minSepAngular = angularSeparation(minSepPoints, config.radius);

    // 3. Block layout on the sorted (unrolled) longitudes — windowed (bounded
    //    PAV) when the placements carry displacement windows, else the legacy
    //    unbounded PAV.
    const adjustedSorted = hasWindows
      ? boundedBlockLayout(
          unrolledLongitudes,
          unrolledLo as number[],
          unrolledHi as number[],
          minSepAngular,
        )
      : buildBlocksAndPlace(unrolledLongitudes, minSepAngular);

    // 4. Un-sort back to original placement order; normalize wraparound.
    const adjustedByIndex = new Array<number>(placements.length).fill(0);
    sortedIndices.forEach((originalIndex, k) => {
      let long = adjustedSorted[k];
      while (long < 0) long += 360;
      while (long >= 360) long -= 360;
      adjustedByIndex[originalIndex] = long;
    });

    // 5. Build layout positions (input order).
    return placements.map((p, index) => ({
      id: p.id,
      trueLongitude: p.longitude,
      adjustedLongitude: adjustedByIndex[index],
    }));
  }
}

// MARK: - Sort

/**
 * Sort placement indices by true longitude, unrolling the circle at its
 * **largest empty arc** so the sort seam never slices a tight cluster.
 *
 * DELIBERATE DIVERGENCE from Swift (`sortIndicesByLongitudeWithWraparound`
 * :263-279): the Swift original shifts everything below 180° by +360° when
 * the span exceeds 180°, which fixes the seam at 0°/180°. A conjunction
 * straddling that fixed seam (e.g. 179° + 181°) got its two halves pushed to
 * opposite ends of the sorted list ~358° apart; the linear PAV sweep then
 * never re-merged them — so min-separation was never enforced (overlap) and
 * the block-mean overshoot around the seam inverted their order. Cutting at
 * the actual widest empty gap guarantees the seam is nowhere near a cluster.
 *
 * Returns the sorted indices AND the unrolled (monotonically increasing)
 * longitudes the block layout operates on; the un-unroll back to [0°, 360°)
 * happens in the caller's final normalization step.
 */
function sortIndicesAtLargestGap(
  longitudes: number[],
  windowLos?: number[],
  windowHis?: number[],
): {
  sortedIndices: number[];
  unrolledLongitudes: number[];
  unrolledLo?: number[];
  unrolledHi?: number[];
} {
  const n = longitudes.length;
  const order = longitudes
    .map((_, idx) => idx)
    .sort((a, b) => longitudes[a] - longitudes[b]);
  const sorted = order.map((idx) => longitudes[idx]);

  if (n <= 1) {
    return {
      sortedIndices: order,
      unrolledLongitudes: sorted,
      unrolledLo: windowLos ? order.map((i) => windowLos[i]) : undefined,
      unrolledHi: windowHis ? order.map((i) => windowHis[i]) : undefined,
    };
  }

  // Largest circular gap between consecutive sorted longitudes; the seam
  // (sort boundary) sits there.
  let bestGap = -1;
  let bestIdx = -1;
  for (let k = 0; k < n; k++) {
    const a = sorted[k];
    const b = k + 1 === n ? sorted[0] + 360 : sorted[k + 1];
    const gap = b - a;
    if (gap > bestGap) {
      bestGap = gap;
      bestIdx = k;
    }
  }

  // Unroll starting just after the largest gap, adding 360 so the sequence
  // is monotonically increasing — windows shift in lockstep with the value.
  const startIdx = (bestIdx + 1) % n;
  const unrolledLongitudes = new Array<number>(n);
  const sortedIndices = new Array<number>(n);
  const unrolledLo = windowLos ? new Array<number>(n) : undefined;
  const unrolledHi = windowHis ? new Array<number>(n) : undefined;
  for (let k = 0; k < n; k++) {
    const srcIdx = (startIdx + k) % n;
    let value = sorted[srcIdx];
    let shift = 0;
    if (k > 0 && value < unrolledLongitudes[k - 1]) {
      shift = 360;
      value += 360;
    }
    unrolledLongitudes[k] = value;
    sortedIndices[k] = order[srcIdx];
    if (unrolledLo) unrolledLo[k] = windowLos![srcIdx] + shift;
    if (unrolledHi) unrolledHi[k] = windowHis![srcIdx] + shift;
  }

  return { sortedIndices, unrolledLongitudes, unrolledLo, unrolledHi };
}

// MARK: - PAV Block Layout

/**
 * Block descriptor used during the forward sweep.
 * (Swift `LayoutBlock` :287-293; `mean` is computed on demand.)
 */
interface LayoutBlock {
  /** sum of member true longitudes (for computing the block mean) */
  sumTrueLong: number;
  /** number of members in the block */
  size: number;
  /** position in the sorted array where this block's members begin */
  startIndex: number;
}

/**
 * Pool Adjacent Violators (PAV) — 1D isotonic regression with min-gap constraints.
 *
 * Single forward sweep through the sorted longitudes building contiguous
 * blocks of planets whose required separation is violated. Each block is
 * placed centered at the mean of its members' true longitudes with members
 * evenly spaced at `minSeparation`. When a new block forms, the inner loop
 * cascades backward — merging with previous blocks if their placement would
 * now overlap.
 *
 * Returns adjusted longitudes in the same sorted order, satisfying:
 *   `adjusted[i+1] - adjusted[i] >= minSeparation` for all i, with the sum
 *   of squared `(adjusted[i] - sortedLongitudes[i])` minimized.
 *
 * (Swift `buildBlocksAndPlace` :311-371, structural port — same sweep
 * order, same merge condition.)
 */
function buildBlocksAndPlace(sortedLongitudes: number[], minSeparation: number): number[] {
  const n = sortedLongitudes.length;
  if (n <= 1) return sortedLongitudes.slice();

  // Build blocks via stack-based forward sweep.
  const stack: LayoutBlock[] = [];

  for (let i = 0; i < n; i++) {
    const current: LayoutBlock = {
      sumTrueLong: sortedLongitudes[i],
      size: 1,
      startIndex: i,
    };

    // Backward cascade: while merging with the top of the stack is required,
    // merge and re-check.
    let top = stack[stack.length - 1];
    while (top !== undefined) {
      // Merge condition: the new block's first member, placed around
      // current.mean, would sit within minSeparation of the top block's
      // last member, placed around top.mean.
      //
      //   top last member position  = top.mean + (top.size - 1) * minSep / 2
      //   new first member position = current.mean - (current.size - 1) * minSep / 2
      //
      //   Required gap between them: >= minSep
      //   Violated when: (current.mean - (current.size - 1)*minSep/2)
      //                  - (top.mean + (top.size - 1)*minSep/2) < minSep
      //   ↓ rearrange ↓
      //                  current.mean - top.mean
      //                  < ((top.size + current.size) / 2.0) * minSep
      const required = ((top.size + current.size) / 2.0) * minSeparation;
      const currentMean = current.sumTrueLong / current.size;
      const topMean = top.sumTrueLong / top.size;
      if (currentMean - topMean < required) {
        // Merge top into current.
        current.sumTrueLong += top.sumTrueLong;
        current.size += top.size;
        current.startIndex = top.startIndex;
        stack.pop();
        top = stack[stack.length - 1];
      } else {
        break;
      }
    }

    stack.push(current);
  }

  // Place each block: members at evenly spaced positions around the block mean.
  const adjusted = new Array<number>(n).fill(0);
  for (const block of stack) {
    const mean = block.sumTrueLong / block.size;
    const offset = ((block.size - 1) / 2.0) * minSeparation;
    const start = mean - offset;
    for (let k = 0; k < block.size; k++) {
      adjusted[block.startIndex + k] = start + k * minSeparation;
    }
  }

  return adjusted;
}

// MARK: - Bounded Block Layout (windowed PAV)

/** Clamp `value` into `[lo, hi]`. */
function clampValue(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value));
}

/**
 * Bounded block layout — pool-adjacent-violators with each planet pinned to
 * its displacement window `[lo, hi]` (its own house, else sign).
 *
 * Reduces to bounded isotonic regression. With `z_i = y_i − i·g` (g = min
 * separation), "spread ≥ g apart" becomes "z non-decreasing" and each window
 * `[lo_i, hi_i]` becomes `[lo_i − i·g, hi_i − i·g]`. PAV pools runs whose
 * clamped block values violate monotonicity; a block's common z is its mean
 * clamped to the members' window intersection.
 *
 * A block whose intersection is empty — the cluster can't be both spread and
 * in-window — is **relaxed** (the infeasibility policy): its members are
 * re-spaced in y-space to exactly fill the available window (spacing < g,
 * down to touching). This keeps them in-house and accepts the overlap,
 * rather than breaking the house bound.
 *
 * Returns adjusted longitudes in sorted (unrolled) order.
 */
function boundedBlockLayout(
  unrolledLongitudes: number[],
  unrolledLo: number[],
  unrolledHi: number[],
  minSeparation: number,
): number[] {
  const n = unrolledLongitudes.length;
  if (n <= 1) return unrolledLongitudes.slice();

  const g = minSeparation;

  interface Block {
    sum: number;
    count: number;
    lo: number;
    hi: number;
    start: number;
    end: number; // inclusive, in unrolled index space
  }

  const blocks: Block[] = [];
  for (let i = 0; i < n; i++) {
    // z-space values: x' = x − i·g, lo' = lo − i·g, hi' = hi − i·g.
    const block: Block = {
      sum: unrolledLongitudes[i] - i * g,
      count: 1,
      lo: unrolledLo[i] - i * g,
      hi: unrolledHi[i] - i * g,
      start: i,
      end: i,
    };
    blocks.push(block);

    // Backward cascade: merge while the previous block's clamped value
    // exceeds this block's (monotonicity violation in z-space).
    while (blocks.length >= 2) {
      const prev = blocks[blocks.length - 2];
      const cur = blocks[blocks.length - 1];
      const prevVal = clampValue(prev.sum / prev.count, prev.lo, prev.hi);
      const curVal = clampValue(cur.sum / cur.count, cur.lo, cur.hi);
      if (prevVal <= curVal) break;
      prev.sum += cur.sum;
      prev.count += cur.count;
      prev.lo = Math.max(prev.lo, cur.lo);
      prev.hi = Math.min(prev.hi, cur.hi);
      prev.end = cur.end;
      blocks.pop();
    }
  }

  const adjusted = new Array<number>(n);
  for (const block of blocks) {
    if (block.lo <= block.hi) {
      // Feasible: common z = mean clamped to the window intersection.
      const z = clampValue(block.sum / block.count, block.lo, block.hi);
      for (let i = block.start; i <= block.end; i++) {
        adjusted[i] = z + i * g;
      }
    } else {
      // Infeasible: relax the gap — re-space to fill the y-space window.
      const k = block.end - block.start + 1;
      let loY = -Infinity;
      let hiY = Infinity;
      let sumY = 0;
      for (let i = block.start; i <= block.end; i++) {
        loY = Math.max(loY, unrolledLo[i]);
        hiY = Math.min(hiY, unrolledHi[i]);
        sumY += unrolledLongitudes[i];
      }
      if (loY > hiY) {
        // Disjoint windows — degenerate; pin at the mean.
        loY = hiY = sumY / k;
      }
      const s = k > 1 ? (hiY - loY) / (k - 1) : 0;
      const meanY = sumY / k;
      const first = k > 1
        ? clampValue(meanY - ((k - 1) * s) / 2, loY, hiY - (k - 1) * s)
        : clampValue(meanY, loY, hiY);
      for (let i = block.start; i <= block.end; i++) {
        adjusted[i] = first + (i - block.start) * s;
      }
    }
  }

  return adjusted;
}

// MARK: - Bounding Box Calculation

/**
 * Bounding-box side length for a planet (Swift `calculateBoundingBox(...).width`
 * :437-451). Only considers the glyph/circle size — degree text is allowed
 * to overlap. Position-independent (uniform bbox), so the point parameter of
 * the Swift original drops out.
 */
function boundingBoxSize(config: PlanetLayoutConfig): number {
  // Glyph size
  const glyphSize = config.useGlyphs ? config.glyphSize : config.circleRadius * 2;

  // Add minimal padding (Swift hardcodes 2.0)
  const padding = config.padding ?? 2.0;
  return glyphSize + padding;
}

// MARK: - Helper Methods

/**
 * Convert a chord (center-to-center screen distance) into the angular
 * separation in degrees that would produce it on this ring's radius.
 * Caller is responsible for assembling the required center distance from
 * its components (bbox + nudge, or any other contribution).
 *
 * (Swift `angularSeparation(forCenterDistance:)` :462-468.)
 */
function angularSeparation(centerDistance: number, radius: number): number {
  // Using: chord = 2 * radius * sin(theta/2)
  // Therefore: theta = 2 * arcsin(chord / (2 * radius))
  const halfChord = Math.min(centerDistance / 2.0, radius);
  const halfAngleRadians = Math.asin(halfChord / radius);
  return 2.0 * halfAngleRadians * (180.0 / Math.PI);
}
