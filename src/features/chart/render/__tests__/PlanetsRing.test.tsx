/**
 * PlanetsRing (Task 9) — layout-level tests per the task brief: assert on
 * `useWheelLayout` output (a plain function call via a tiny harness
 * component), not on drawn pixels — the Skia mock (jest.setup.js) returns
 * null from useSVG/useFont's typeface, so pixel-level assertions aren't
 * meaningful here; ChartWheel.test.tsx already covers "does it mount".
 *
 * The conjunction cluster: reading sibly-1776.json, Venus (93.10°) and
 * Jupiter (95.93°) sit 2.83° apart — both visible under the classic preset's
 * `enabledBodies` — well inside the min angular separation the PAV layout
 * requires at the planets ring's radius (glyphSize 18 + nudgeDistance 8 at a
 * ring several tens of points wide demands several degrees), so at least one
 * of the pair must be nudged off its true longitude.
 */

import React from "react";
import TestRenderer, { act } from "react-test-renderer";

import { buildConfiguration } from "../../config/buildConfiguration";
import type { ChartCalculationResponse } from "../../config/engine-types";
import chart from "../../fixtures/engine/sibly-1776.json";
import classic from "../../fixtures/presets/classic.json";
import { parsePreset } from "../../schema/preset";
import { useWheelLayout, type WheelLayout } from "../useWheelLayout";

/** Minimal renderHook substitute — react-test-renderer has no hook harness
 * of its own, and @testing-library/react-native/react-hooks isn't a devDep
 * (see ChartWheel.test.tsx's header note on the scaffold's choice). */
function HookHarness({
  config,
  size,
  onResult,
}: {
  config: ReturnType<typeof buildConfiguration>;
  size: number;
  onResult: (layout: WheelLayout) => void;
}) {
  const layout = useWheelLayout(config, size);
  onResult(layout);
  return null;
}

function layoutFor(size = 390): WheelLayout {
  const cfg = buildConfiguration(chart as ChartCalculationResponse, parsePreset(classic));
  let captured: WheelLayout | undefined;
  act(() => {
    TestRenderer.create(<HookHarness config={cfg} size={size} onResult={(l) => (captured = l)} />);
  });
  if (!captured) throw new Error("useWheelLayout never produced a layout");
  return captured;
}

function planetsRingIndex(layout: WheelLayout): number {
  const index = layout.rings.findIndex((r) => r.type.kind === "planets");
  if (index < 0) throw new Error("classic preset has no planets ring");
  return index;
}

test("useWheelLayout produces one planet layout entry per visible placement", () => {
  const layout = layoutFor();
  const ringIndex = planetsRingIndex(layout);
  const ring = layout.rings[ringIndex];
  if (ring.type.kind !== "planets") throw new Error("unreachable");

  const positions = layout.planetLayouts.get(ringIndex);
  expect(positions).toBeDefined();
  expect(positions).toHaveLength(ring.type.placements.length);

  const ids = positions!.map((p) => p.placement.id);
  expect(new Set(ids)).toEqual(new Set(ring.type.placements.map((p) => p.id)));
});

test("the Venus/Jupiter conjunction cluster gets PAV-nudged off true longitude", () => {
  const layout = layoutFor();
  const ringIndex = planetsRingIndex(layout);
  const positions = layout.planetLayouts.get(ringIndex)!;

  const venus = positions.find((p) => p.placement.id === "venus");
  const jupiter = positions.find((p) => p.placement.id === "jupiter");
  expect(venus).toBeDefined();
  expect(jupiter).toBeDefined();

  // True longitudes are 2.83° apart — far tighter than the ring's minimum
  // angular separation (glyphSize + nudgeDistance projected onto the
  // planets ring radius, ~9° at this preset/size), so at least one member
  // must move. `PlanetRingLayoutCoordinator.calculateLayout()` (Task 6)
  // returns `PlanetLayoutPosition` — Cartesian `originalPosition`/
  // `adjustedPosition`, not the raw `trueLongitude`/`adjustedLongitude`
  // pair (that shape belongs to `PlanetLayoutEngine`'s angular-only output,
  // consumed internally by the coordinator) — so "moved off true longitude"
  // is asserted as "adjusted position differs from the original position at
  // the true longitude", the Cartesian embodiment of the same fact.
  const moved = (p: NonNullable<typeof venus>) =>
    p.adjustedPosition.x !== p.originalPosition.x || p.adjustedPosition.y !== p.originalPosition.y;
  expect(moved(venus!) || moved(jupiter!)).toBe(true);
});
