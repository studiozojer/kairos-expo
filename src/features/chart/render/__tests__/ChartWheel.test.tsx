/**
 * ChartWheel smoke test (Task 8) — the real sibly-1776 engine fixture through
 * the classic preset, mounted at identity transform.
 *
 * Skia is mocked per its own jest recipe (jest.setup.js wires the package's
 * jestSetup.js): Canvas is a plain RN View, `Skia` is the real CanvasKit-backed
 * API (so path construction in useMemo genuinely runs), and useSVG returns
 * null — Glyph renders null here by design.
 *
 * @testing-library/react-native is not in devDeps — react-test-renderer is
 * (the scaffold's choice for component tests).
 */

import React from "react";
import TestRenderer, { act } from "react-test-renderer";

import { buildConfiguration } from "../../config/buildConfiguration";
import type { ChartCalculationResponse } from "../../config/engine-types";
import chart from "../../fixtures/engine/sibly-1776.json";
import classic from "../../fixtures/presets/classic.json";
import { parsePreset } from "../../schema/preset";
import { ChartWheel } from "../ChartWheel";

test("wheel mounts with classic + sibly at identity transform", () => {
  const cfg = buildConfiguration(chart as ChartCalculationResponse, parsePreset(classic));
  expect(() => {
    act(() => {
      TestRenderer.create(<ChartWheel config={cfg} size={390} />);
    });
  }).not.toThrow();
});

test("the zodiac ring draws 12 sign glyphs", () => {
  const cfg = buildConfiguration(chart as ChartCalculationResponse, parsePreset(classic));
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<ChartWheel config={cfg} size={390} />);
  });
  // Match on the Glyph props contract, not the component type: React collapses
  // a memo() fiber's type to the inner function (SimpleMemoComponent), so
  // findAllByType(Glyph) misses the memo object.
  const glyphs = renderer.root.findAll(
    (node) => typeof node.props?.name === "string" && node.props.name.startsWith("signs/"),
  );
  expect(glyphs).toHaveLength(12);
  const names = glyphs.map((g) => g.props.name);
  expect(names).toContain("signs/aries");
  expect(names).toContain("signs/pisces");
});
