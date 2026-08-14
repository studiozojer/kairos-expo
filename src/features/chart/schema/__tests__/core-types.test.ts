import { alias, bool, num, obj, str, strArr } from "../decode";
import {
  CHART_COLORS_DEFAULT,
  GLOBAL_CHART_VARIABLES_DEFAULT,
  OVERLAP_PREVENTION_DEFAULT,
  RING_THICKNESS_DEFAULT,
  VISIBILITY_CONFIGURATION_DEFAULT,
  parseChartColors,
  parseGlobalChartVariables,
  parseRingThickness,
  parseVisibilityConfiguration,
  serializeChartColors,
  serializeGlobalChartVariables,
  serializeRingThickness,
  serializeVisibilityConfiguration,
} from "../core-types";

// ---------------------------------------------------------------------------
// decode.ts helpers
// ---------------------------------------------------------------------------

test("num falls back on non-numbers, keeps falsy-but-valid 0", () => {
  expect(num(undefined, 8)).toBe(8);
  expect(num("20", 8)).toBe(8);
  expect(num(null, 8)).toBe(8);
  expect(num(NaN, 8)).toBe(8);
  expect(num(Infinity, 8)).toBe(8);
  expect(num(20, 8)).toBe(20);
  expect(num(0, 8)).toBe(0);
});

test("bool falls back on non-booleans, keeps false", () => {
  expect(bool(undefined, true)).toBe(true);
  expect(bool("yes", true)).toBe(true);
  expect(bool(1, false)).toBe(false);
  expect(bool(false, true)).toBe(false);
});

test("str falls back on non-strings, keeps empty string", () => {
  expect(str(undefined, "x")).toBe("x");
  expect(str(42, "x")).toBe("x");
  expect(str("", "x")).toBe("");
});

test("strArr is all-or-default and copies", () => {
  expect(strArr(undefined, ["a"])).toEqual(["a"]);
  expect(strArr(["a", "b"], [])).toEqual(["a", "b"]);
  expect(strArr(["a", 1], ["d"])).toEqual(["d"]);
  expect(strArr("nope", ["d"])).toEqual(["d"]);
  const d = ["d"];
  const out = strArr(undefined, d);
  expect(out).toEqual(d);
  expect(out).not.toBe(d);
});

test("obj returns {} for non-objects (incl. null and arrays)", () => {
  expect(obj(null)).toEqual({});
  expect(obj(undefined)).toEqual({});
  expect(obj([])).toEqual({});
  expect(obj("s")).toEqual({});
  expect(obj(7)).toEqual({});
  expect(obj({ a: 1 })).toEqual({ a: 1 });
});

test("alias: first present key wins, current first; null/undefined count as absent", () => {
  expect(alias({ a: 1, b: 2 }, "a", "b")).toBe(1);
  expect(alias({ b: 2 }, "a", "b")).toBe(2);
  expect(alias({ a: null, b: 2 }, "a", "b")).toBe(2);
  expect(alias({ a: undefined, b: 2 }, "a", "b")).toBe(2);
  expect(alias({ c: 3, b: 2 }, "a", "b", "c")).toBe(2);
  expect(alias({}, "a", "b")).toBeUndefined();
});

// ---------------------------------------------------------------------------
// RingThickness
// ---------------------------------------------------------------------------

test("parseRingThickness(undefined) is the default (auto)", () => {
  expect(parseRingThickness(undefined)).toEqual(RING_THICKNESS_DEFAULT);
  expect(parseRingThickness(undefined)).toEqual({ kind: "auto" });
});

test("parseRingThickness reads the template wire shapes", () => {
  // Quoted from PresetTemplates/classic.json /soloChart/rings[0] and [1].
  expect(parseRingThickness({ kind: "fixed", value: 20 })).toEqual({ kind: "fixed", value: 20 });
  expect(parseRingThickness({ kind: "auto" })).toEqual({ kind: "auto" });
});

test("parseRingThickness falls back to auto on malformed input", () => {
  expect(parseRingThickness({ kind: "fixed" })).toEqual({ kind: "auto" });
  expect(parseRingThickness({ kind: "fixed", value: "20" })).toEqual({ kind: "auto" });
  expect(parseRingThickness({ kind: "weird" })).toEqual({ kind: "auto" });
  expect(parseRingThickness("fixed")).toEqual({ kind: "auto" });
  expect(parseRingThickness(24)).toEqual({ kind: "auto" });
});

test("RingThickness roundtrips through serialize", () => {
  for (const sample of [{ kind: "fixed", value: 20 }, { kind: "auto" }]) {
    expect(parseRingThickness(serializeRingThickness(parseRingThickness(sample)))).toEqual(
      parseRingThickness(sample),
    );
  }
  expect(serializeRingThickness({ kind: "fixed", value: 24 })).toEqual({ kind: "fixed", value: 24 });
});

// ---------------------------------------------------------------------------
// ChartColors
// ---------------------------------------------------------------------------

// Verbatim from PresetTemplates/classic.json /colors.
const CLASSIC_COLORS_WIRE = {
  celestialBodyColors: {
    angles: { defaultColor: { layer: "ic", source: "semantic", value: "primary" } },
    otherBodies: { defaultColor: { layer: "ic", source: "semantic", value: "primary" } },
    planetHues: {
      jupiter: "green",
      mars: "red",
      mercury: "blue",
      moon: "gold",
      neptune: "indigo",
      pluto: "magenta",
      saturn: "orange",
      sun: "gold",
      uranus: "sky",
      venus: "byzantium",
    },
  },
  zodiacColors: {
    zodiacHues: {
      signs: [
        "red", "orange", "yellow", "lime", "green", "aqua",
        "sky", "blue", "indigo", "purple", "byzantium", "magenta",
      ],
      variant: "coloredBackground",
    },
  },
};

test("parseChartColors(undefined) is the default", () => {
  const d = parseChartColors(undefined);
  expect(d).toEqual(CHART_COLORS_DEFAULT);
  // Load-bearing default values (Swift ColorSets.swift / Rust colors.rs):
  expect(d.zodiacColors.zodiacHues.variant).toBe("minimal");
  expect(d.zodiacColors.zodiacHues.signs).toHaveLength(12);
  expect(d.zodiacColors.zodiacHues.signs.every((h) => h === "greyscale")).toBe(true);
  expect(d.celestialBodyColors.planetHues).toEqual({
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
  });
  expect(d.celestialBodyColors.otherBodies.defaultColor).toEqual({
    source: "semantic",
    value: "primary",
    layer: "ic",
  });
  expect(d.celestialBodyColors.angles.defaultColor).toEqual({
    source: "semantic",
    value: "primary",
    layer: "ic",
  });
});

test("parseChartColors fills missing fields with defaults at every nesting level", () => {
  const p = parseChartColors({ celestialBodyColors: { planetHues: { sun: "red" } } });
  expect(p.celestialBodyColors.planetHues.sun).toBe("red");
  expect(p.celestialBodyColors.planetHues.moon).toBe("gold");
  expect(p.celestialBodyColors.otherBodies).toEqual(CHART_COLORS_DEFAULT.celestialBodyColors.otherBodies);
  expect(p.zodiacColors).toEqual(CHART_COLORS_DEFAULT.zodiacColors);

  // Wire key is "signs" (Swift CodingKeys hues→"signs"; Rust #[serde(rename = "signs")]).
  const z = parseChartColors({ zodiacColors: { zodiacHues: { variant: "fullHue", signs: ["red"] } } });
  expect(z.zodiacColors.zodiacHues.variant).toBe("fullHue");
  expect(z.zodiacColors.zodiacHues.signs).toEqual(["red"]);
});

test("parseChartColors tolerates malformed input", () => {
  expect(parseChartColors("nope")).toEqual(CHART_COLORS_DEFAULT);
  expect(parseChartColors({ zodiacColors: { zodiacHues: { variant: 7, signs: "red" } } })).toEqual(
    CHART_COLORS_DEFAULT,
  );
  expect(parseChartColors({ celestialBodyColors: { angles: { defaultColor: { source: 1 } } } })).toEqual(
    CHART_COLORS_DEFAULT,
  );
});

test("ChartColors roundtrips through serialize (template fixture)", () => {
  const once = parseChartColors(CLASSIC_COLORS_WIRE);
  expect(once.zodiacColors.zodiacHues.variant).toBe("coloredBackground");
  expect(parseChartColors(serializeChartColors(once))).toEqual(once);
});

// ---------------------------------------------------------------------------
// GlobalChartVariables
// ---------------------------------------------------------------------------

// Verbatim from PresetTemplates/classic.json /soloChart/globalSettings.
const CLASSIC_GLOBAL_SETTINGS_WIRE = {
  defaultHitRadius: 20,
  margin: 8,
  minimumInnerRadius: 75,
  moduleHitRadiusOverrides: {},
  overlapPrevention: { enabled: true, nudgeDistance: 1 },
  ringGap: 0,
  staticOrientationDegree: 300,
  variableRingSizing: "equalDistribution",
};

test("parseGlobalChartVariables(undefined) is the default", () => {
  const d = parseGlobalChartVariables(undefined);
  expect(d).toEqual(GLOBAL_CHART_VARIABLES_DEFAULT);
  expect(d).toEqual({
    margin: 8,
    minimumInnerRadius: 60,
    ringGap: 0,
    variableRingSizing: "equalDistribution",
    defaultHitRadius: 20,
    moduleHitRadiusOverrides: {},
    staticOrientationDegree: 0,
    overlapPrevention: { enabled: true, nudgeDistance: 0 },
  });
});

test("overlapPrevention default nudgeDistance is 0.0 (controller ruling: Swift, not stale Rust 8.0)", () => {
  expect(OVERLAP_PREVENTION_DEFAULT).toEqual({ enabled: true, nudgeDistance: 0 });
  // Missing nudgeDistance inside a present overlapPrevention also falls back to 0.0.
  expect(parseGlobalChartVariables({ overlapPrevention: { enabled: false } }).overlapPrevention).toEqual({
    enabled: false,
    nudgeDistance: 0,
  });
});

test("parseGlobalChartVariables fills missing fields with defaults", () => {
  const p = parseGlobalChartVariables({ margin: 12, variableRingSizing: "explicit" });
  expect(p.margin).toBe(12);
  expect(p.variableRingSizing).toBe("explicit");
  expect(p.minimumInnerRadius).toBe(60);
  expect(p.overlapPrevention).toEqual(OVERLAP_PREVENTION_DEFAULT);
});

test("parseGlobalChartVariables tolerates malformed input", () => {
  expect(parseGlobalChartVariables("nope")).toEqual(GLOBAL_CHART_VARIABLES_DEFAULT);
  // Unknown sizing coerces to the default (Swift would hard-throw on the raw value).
  expect(parseGlobalChartVariables({ variableRingSizing: "weird" }).variableRingSizing).toBe(
    "equalDistribution",
  );
  // Non-numeric override values drop out; non-object overrides fall back to {}.
  expect(
    parseGlobalChartVariables({ moduleHitRadiusOverrides: { zodiacRing: 24, bad: "x" } })
      .moduleHitRadiusOverrides,
  ).toEqual({ zodiacRing: 24 });
  expect(parseGlobalChartVariables({ moduleHitRadiusOverrides: 5 }).moduleHitRadiusOverrides).toEqual({});
});

test("GlobalChartVariables roundtrips through serialize (template fixture)", () => {
  const once = parseGlobalChartVariables(CLASSIC_GLOBAL_SETTINGS_WIRE);
  expect(once.minimumInnerRadius).toBe(75);
  expect(once.staticOrientationDegree).toBe(300);
  expect(once.overlapPrevention).toEqual({ enabled: true, nudgeDistance: 1 });
  expect(parseGlobalChartVariables(serializeGlobalChartVariables(once))).toEqual(once);
});

// ---------------------------------------------------------------------------
// VisibilityConfiguration
// ---------------------------------------------------------------------------

// Verbatim from PresetTemplates/classic.json /visibility — note the wire carries
// body *display names* ("North Node", "Imum Coeli"), not enums.gen.ts ids.
const CLASSIC_VISIBILITY_WIRE = {
  enabledBodies: [
    "Neptune", "Uranus", "Mercury", "Saturn", "Midheaven", "Descendant", "Chiron",
    "North Node", "Moon", "Sun", "Juno", "Jupiter", "Venus", "South Node", "Mars",
    "Pluto", "Ceres", "Pallas", "Ascendant", "Imum Coeli",
  ],
};

test("parseVisibilityConfiguration(undefined) is the Swift default (.minimal — empty set)", () => {
  expect(parseVisibilityConfiguration(undefined)).toEqual(VISIBILITY_CONFIGURATION_DEFAULT);
  expect(parseVisibilityConfiguration(undefined)).toEqual({ enabledBodies: [] });
});

test("parseVisibilityConfiguration fills missing/malformed fields with the default", () => {
  expect(parseVisibilityConfiguration({})).toEqual({ enabledBodies: [] });
  expect(parseVisibilityConfiguration({ enabledBodies: "Sun" })).toEqual({ enabledBodies: [] });
  expect(parseVisibilityConfiguration({ enabledBodies: ["Sun", 42] })).toEqual({ enabledBodies: [] });
  expect(parseVisibilityConfiguration(null)).toEqual({ enabledBodies: [] });
});

test("parseVisibilityConfiguration passes body display names through untouched", () => {
  // Unknown-to-us strings are kept (Swift would throw on the whole blob; this
  // mirror is deliberately more tolerant). Ordering is preserved as written.
  const p = parseVisibilityConfiguration({ enabledBodies: ["Sun", "North Node", "Not A Body"] });
  expect(p.enabledBodies).toEqual(["Sun", "North Node", "Not A Body"]);
});

test("VisibilityConfiguration roundtrips through serialize (template fixture)", () => {
  const once = parseVisibilityConfiguration(CLASSIC_VISIBILITY_WIRE);
  expect(once.enabledBodies).toHaveLength(20);
  expect(parseVisibilityConfiguration(serializeVisibilityConfiguration(once))).toEqual(once);
});
