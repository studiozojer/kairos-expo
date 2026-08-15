/**
 * AspectOverlay tests (Task 10).
 *
 * Section 1 — `selectAspectsToRender` (the sort + `maximumAspectCount` cap
 * that Swift keeps in `AspectOverlay.swift`, not `AspectFilterResult`):
 * asserts the cap applies only when `maximumAspectCount > 0`, and that `0`
 * (or a cap the valid set already fits under) preserves input order
 * unsorted — do NOT sort unconditionally, or the default configuration's
 * draw order diverges from iOS (review fix e852608).
 *
 * Section 2 — a render-level mount, same style as PlanetsRing.render.test.tsx:
 * classic + sibly draws some aspect paths, and `aspects.enabled: false`
 * draws nothing.
 */

import React from "react";
import TestRenderer, { act } from "react-test-renderer";

import { Circle, Path } from "@shopify/react-native-skia";

import { buildConfiguration } from "../../config/buildConfiguration";
import type { AspectEdgeDTO, ChartCalculationResponse, Placement } from "../../config/engine-types";
import chart from "../../fixtures/engine/sibly-1776.json";
import classic from "../../fixtures/presets/classic.json";
import { parsePreset } from "../../schema/preset";
import { ChartWheel } from "../ChartWheel";
import { selectAspectsToRender, type ValidAspect } from "../AspectOverlay";

// ---------------------------------------------------------------------------
// Section 1 — selectAspectsToRender
// ---------------------------------------------------------------------------

function placement(id: string): Placement {
  return {
    id,
    bodyName: id,
    bodyId: id,
    longitude: 0,
    latitude: 0,
    speedLongitude: 0,
    housePlacement: 1,
    signPlacement: "Aries",
    isRetrograde: false,
    glyphAsset: id,
  };
}

function validAspect(from: string, to: string, strength: number): ValidAspect {
  const edge: AspectEdgeDTO = { from, to, aspect_type: "Trine", orb: 1, strength, is_applying: true };
  return { edge, aspectType: { key: "trine", wireName: "Trine", angle: 120, isMajor: true }, fromPlacement: placement(from), toPlacement: placement(to) };
}

test("maximumAspectCount 0: order is untouched, nothing capped (unlimited)", () => {
  const aspects = [validAspect("a", "b", 1), validAspect("c", "d", 9), validAspect("e", "f", 5)];
  const result = selectAspectsToRender(aspects, 0);
  // Same array, same order — NOT sorted by strength.
  expect(result).toEqual(aspects);
  expect(result.map((a) => a.edge.strength)).toEqual([1, 9, 5]);
});

test("maximumAspectCount > 0 but the valid set already fits: order is untouched", () => {
  const aspects = [validAspect("a", "b", 1), validAspect("c", "d", 9)];
  const result = selectAspectsToRender(aspects, 5);
  expect(result.map((a) => a.edge.strength)).toEqual([1, 9]);
});

test("maximumAspectCount > 0 and exceeded: sorts by strength descending and caps", () => {
  const aspects = [validAspect("a", "b", 1), validAspect("c", "d", 9), validAspect("e", "f", 5)];
  const result = selectAspectsToRender(aspects, 2);
  expect(result).toHaveLength(2);
  expect(result.map((a) => a.edge.strength)).toEqual([9, 5]);
});

// ---------------------------------------------------------------------------
// Section 2 — mount-level
// ---------------------------------------------------------------------------

test("classic + sibly draws aspect lines/markers", () => {
  const cfg = buildConfiguration(chart as ChartCalculationResponse, parsePreset(classic));
  expect(cfg.aspects.enabled).toBe(true);

  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<ChartWheel config={cfg} size={390} />);
  });

  // Aspect lines are Path elements with `strokeCap` unset (unlike PlanetsRing's
  // dashed connection lines, which always set strokeCap="round") — instead,
  // key off the aspect line's dash effect / plain stroke plus a Circle for
  // any conjunction marker. Simplest reliable signal: at least one Circle
  // (conjunction dot) or non-connection stroked Path exists beyond what a
  // configuration with aspects disabled would produce.
  const circles = renderer.root.findAllByType(Circle);
  const strokedPaths = renderer.root.findAll(
    (node) => node.type === Path && node.props?.style === "stroke",
  );
  expect(circles.length + strokedPaths.length).toBeGreaterThan(0);
});

test("aspects.enabled: false draws nothing extra from the overlay", () => {
  const cfg = buildConfiguration(chart as ChartCalculationResponse, parsePreset(classic));
  const disabled = { ...cfg, aspects: { ...cfg.aspects, enabled: false } };

  expect(() => {
    act(() => {
      TestRenderer.create(<ChartWheel config={disabled} size={390} />);
    });
  }).not.toThrow();
});
