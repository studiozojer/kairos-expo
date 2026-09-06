/**
 * PlanetsRing render-level tests (Task 9 fix round 1, findings 2 + 3).
 *
 * Unlike PlanetsRing.test.tsx (layout-level, asserts on `useWheelLayout`
 * output), these mount `<ChartWheel>` and inspect the rendered React tree —
 * the Skia jest mock's `Group`/`Path`/`Glyph`-as-props are real React
 * components under react-test-renderer (only the native asset hooks are
 * stubbed), so prop-level assertions on color/fillType are meaningful, same
 * pattern as ChartWheel.test.tsx's sign-glyph-count check.
 */

import React from "react";
import TestRenderer, { act } from "react-test-renderer";

import { themeFor } from "@/theme";

import { buildConfiguration } from "../../config/buildConfiguration";
import type { ChartCalculationResponse } from "../../config/engine-types";
import chart from "../../fixtures/engine/sibly-1776.json";
import classic from "../../fixtures/presets/classic.json";
import modern from "../../fixtures/presets/modern.json";
import { parsePreset } from "../../schema/preset";
import { PLANETS_STYLE_TYPE, type PlanetsRingStyle } from "../../schema/ring-styles";
import { ChartWheel } from "../ChartWheel";
import { boundaryLineColor, cuspLineColor, defaultGlyphColor } from "../rings/PlanetsRing";
import type { PlanetRenderPlacement } from "../useWheelLayout";

const lightTheme = themeFor("light");

// ---------------------------------------------------------------------------
// Unit tests — the three color helpers directly (finding 2 + 3's exact
// branches), independent of the render harness.
// ---------------------------------------------------------------------------

const basePlacement: PlanetRenderPlacement = {
  id: "sun",
  bodyName: "Sun",
  bodyId: "sun",
  body: "sun",
  longitude: 10,
  latitude: 0,
  speedLongitude: 1,
  housePlacement: 1,
  signPlacement: "Aries",
  isRetrograde: false,
  glyphAsset: "sun",
};

const baseColors = {
  zodiacColors: { zodiacHues: { variant: "minimal", signs: Array(12).fill("greyscale") } },
  celestialBodyColors: {
    planetHues: {
      sun: "gold",
      moon: "gold",
      mercury: "blue",
      venus: "byzantium",
      mars: "red",
      jupiter: "green",
      saturn: "orange",
      uranus: "sky",
      neptune: "indigo",
      pluto: "magenta",
    },
    otherBodies: { defaultColor: { source: "semantic", value: "primary", layer: "ic" } },
    angles: { defaultColor: { source: "semantic", value: "primary", layer: "ic" } },
  },
};

function planetsStyle(overrides: Partial<PlanetsRingStyle>): PlanetsRingStyle {
  const cfg = buildConfiguration(chart as ChartCalculationResponse, parsePreset(classic));
  const ring = cfg.rings.find((r) => r.type.kind === "planets")!;
  const base = ring.style as PlanetsRingStyle;
  return { ...base, ...overrides };
}

test("defaultGlyphColor: style.glyphColor overrides celestialBodyColor when set", () => {
  const withOverride = planetsStyle({ glyphColor: { source: "hex", value: "#123456" } });
  expect(defaultGlyphColor(basePlacement, withOverride, baseColors, lightTheme)).toBe("#123456");
});

test("defaultGlyphColor: falls back to celestialBodyColor when glyphColor is unset", () => {
  const withoutOverride = planetsStyle({ glyphColor: undefined });
  const result = defaultGlyphColor(basePlacement, withoutOverride, baseColors, lightTheme);
  // Sun's planet hue is "gold" — never the raw semantic ic/primary fallback.
  expect(result).not.toBe(lightTheme.color.icPrimary);
});

test("cuspLineColor: angular cusp prefers angularCuspLineColor over cuspLineColor", () => {
  const style = planetsStyle({
    angularCuspLineColor: { source: "hex", value: "#111111" },
    cuspLineColor: { source: "hex", value: "#222222" },
  });
  expect(cuspLineColor(true, style, lightTheme)).toBe("#111111");
  expect(cuspLineColor(false, style, lightTheme)).toBe("#222222");
});

test("cuspLineColor: angular cusp falls back to cuspLineColor, then bd/primary", () => {
  const withCuspOnly = planetsStyle({
    angularCuspLineColor: undefined,
    cuspLineColor: { source: "hex", value: "#333333" },
  });
  expect(cuspLineColor(true, withCuspOnly, lightTheme)).toBe("#333333");

  const withNeither = planetsStyle({ angularCuspLineColor: undefined, cuspLineColor: undefined });
  expect(cuspLineColor(true, withNeither, lightTheme)).toBe(lightTheme.color.bdPrimary);
  expect(cuspLineColor(false, withNeither, lightTheme)).toBe(lightTheme.color.bdPrimary);
});

test("boundaryLineColor: style override, else bd/primary", () => {
  const withOverride = planetsStyle({ boundaryLineColor: { source: "hex", value: "#abcdef" } });
  expect(boundaryLineColor(withOverride, lightTheme)).toBe("#abcdef");

  const withoutOverride = planetsStyle({ boundaryLineColor: undefined });
  expect(boundaryLineColor(withoutOverride, lightTheme)).toBe(lightTheme.color.bdPrimary);
});

// ---------------------------------------------------------------------------
// Render-level integration — mount the real wheel with a modified config.
// ---------------------------------------------------------------------------

test("glyphColor override reaches both the planet glyphs and their connection lines", () => {
  const cfg = buildConfiguration(chart as ChartCalculationResponse, parsePreset(classic));
  const planetsIndex = cfg.rings.findIndex((r) => r.type.kind === "planets");
  const ring = cfg.rings[planetsIndex];
  if (ring.style.$type !== PLANETS_STYLE_TYPE) throw new Error("unreachable");
  cfg.rings[planetsIndex] = {
    ...ring,
    style: { ...ring.style, glyphColor: { source: "hex", value: "#654321" } },
  };

  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<ChartWheel config={cfg} size={390} />);
  });

  const planetGlyphs = renderer.root.findAll(
    (node) => typeof node.props?.name === "string" && node.props.name.startsWith("celestials/"),
  );
  expect(planetGlyphs.length).toBeGreaterThan(0);
  for (const glyph of planetGlyphs) {
    expect(glyph.props.color).toBe("#654321");
  }

  // Connection lines exist (Venus/Jupiter conjunction, see PlanetsRing.test.tsx)
  // and carry the SAME override color at 50% alpha (withAlphaFactor("#654321", 0.5)).
  const connectionLines = renderer.root.findAll(
    (node) => node.props?.strokeCap === "round" && typeof node.props?.color === "string",
  );
  expect(connectionLines.length).toBeGreaterThan(0);
  for (const line of connectionLines) {
    expect(line.props.color.toLowerCase().startsWith("#654321")).toBe(true);
  }
});

test("a ring background fill renders (evenOdd annulus) when the style sets backgroundColor", () => {
  const cfg = buildConfiguration(chart as ChartCalculationResponse, parsePreset(modern));
  const ring = cfg.rings.find((r) => r.type.kind === "planets");
  expect(ring).toBeDefined();
  expect(ring!.style.$type === PLANETS_STYLE_TYPE && ring!.style.backgroundColor).toBeDefined();

  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => {
    renderer = TestRenderer.create(<ChartWheel config={cfg} size={390} />);
  });

  const backgroundFills = renderer.root.findAll((node) => node.props?.fillType === "evenOdd");
  expect(backgroundFills.length).toBeGreaterThan(0);
});
