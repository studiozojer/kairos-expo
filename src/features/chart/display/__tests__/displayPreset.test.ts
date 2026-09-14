import { parsePreset } from "../../schema/preset";
import type { ChartCalculationResponse } from "../../config/engine-types";
import {
  RENDERABLE_RING_TYPES,
  bodyChoices,
  isBodyEnabled,
  isRingEnabled,
  renderableRings,
  toggleBody,
  toggleRing,
} from "../displayPreset";

import chartFixture from "../../fixtures/engine/sibly-1776.json";
import classicFixture from "../../fixtures/presets/classic.json";
import traditionalFixture from "../../fixtures/presets/traditional.json";

const chart = chartFixture as ChartCalculationResponse;

describe("toggleRing", () => {
  const preset = parsePreset(classicFixture);

  it("flips enabled on the matching ring, immutably", () => {
    const next = toggleRing(preset, "houses", false);
    expect(isRingEnabled(next, "houses")).toBe(false);
    expect(next.soloChart.rings.length).toBe(preset.soloChart.rings.length);
    // untouched: zodiac + planets still enabled
    expect(isRingEnabled(next, "zodiac")).toBe(true);
    expect(isRingEnabled(next, "planets")).toBe(true);
    // the input preset is not mutated
    expect(isRingEnabled(preset, "houses")).toBe(true);
  });

  it("is a no-op (same reference) for a ring type absent from the preset", () => {
    const next = toggleRing(preset, "cuspAnnotations", false);
    expect(next).toBe(preset);
  });
});

describe("toggleBody", () => {
  const preset = parsePreset(classicFixture);

  it("adds a body display name when enabling", () => {
    const next = toggleBody(preset, "Part of Fortune", true);
    expect(isBodyEnabled(next, "Part of Fortune")).toBe(true);
    expect(isBodyEnabled(preset, "Part of Fortune")).toBe(false);
  });

  it("removes every occurrence when disabling", () => {
    const withDupes = {
      ...preset,
      visibility: { enabledBodies: [...preset.visibility.enabledBodies, "Sun"] },
    };
    const next = toggleBody(withDupes, "Sun", false);
    expect(isBodyEnabled(next, "Sun")).toBe(false);
    expect(next.visibility.enabledBodies).not.toContain("Sun");
  });

  it("is a no-op (same reference) when the state is already as requested", () => {
    expect(toggleBody(preset, "Sun", true)).toBe(preset);
    expect(toggleBody(preset, "Part of Fortune", false)).toBe(preset);
  });
});

describe("renderableRings", () => {
  it("returns only renderable rings, in wire order", () => {
    const classic = parsePreset(classicFixture);
    expect(renderableRings(classic)).toEqual(["zodiac", "planets", "houses"]);
  });

  it("drops non-renderable kinds (study/traditional carry decans, fixedStars, …)", () => {
    const traditional = parsePreset(traditionalFixture);
    const rings = renderableRings(traditional);
    // signRulers/decans/fixedStars parse but have no renderer — excluded.
    expect(rings).toEqual(["zodiac", "planets", "houses"]);
    for (const r of rings) {
      expect((RENDERABLE_RING_TYPES as readonly string[]).includes(r)).toBe(true);
    }
  });
});

describe("bodyChoices", () => {
  it("returns distinct, sorted canonical display names for the chart's bodies", () => {
    const names = bodyChoices(chart);
    // 20 celestial nodes, none duplicate after canonicalization.
    expect(names.length).toBe(20);
    expect(names).toContain("Sun");
    expect(names).toContain("North Node");
    expect(names).toContain("South Node");
    expect(names).toContain("Part of Fortune");
    // sorted
    const sorted = [...names].sort((a, b) => a.localeCompare(b));
    expect(names).toEqual(sorted);
  });

  it("maps the wire's MeanNode/SouthNodeMean to canonical names, not raw strings", () => {
    const names = bodyChoices(chart);
    expect(names).toContain("North Node");
    expect(names).not.toContain("MeanNode");
    expect(names).toContain("South Node");
    expect(names).not.toContain("SouthNodeMean");
  });
});
