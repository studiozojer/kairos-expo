/**
 * Core wire types for chart presets, with hand-rolled tolerant decoders.
 *
 * Mirrors (field names + defaults cross-checked 2026-08-13, no drift except as
 * noted on OVERLAP_PREVENTION_DEFAULT):
 *  - swift/KairosCore/Sources/KairosCore/Presets/CodableTypes/RingThickness.swift
 *    ↔ kairos-engine crates/kairos-core/src/presets/styles.rs (`RingThickness`)
 *  - swift .../Presets/CodableTypes/ChartColors.swift +
 *    swift .../Support/{ColorSets,ColorValue,HueToken}.swift
 *    ↔ crates/kairos-core/src/presets/colors.rs
 *  - swift .../Presets/CodableTypes/GlobalChartVariables.swift +
 *    swift .../Presets/CodableTypes/PlanetsRingStyle.swift (OverlapPreventionConfigV3)
 *    ↔ crates/kairos-core/src/presets/styles.rs
 *  - swift .../Presets/VisibilityConfiguration.swift — Swift-only; Rust has no
 *    counterpart (body visibility moved preset-wide to the Swift side).
 *
 * Tolerance contract: every missing/malformed field falls back to its default
 * (`?? default` semantics); parse functions never throw. This mirrors Swift's
 * `decodeIfPresent ?? .default` and Rust's `#[serde(default)]` — old vaults
 * must never hard-fail. Where Swift would throw on a *present-but-malformed*
 * value (unknown enum raw value, `"fixed"` without `value`), this mirror
 * deliberately falls back to the default instead.
 */

import { bool, num, obj, str, strArr } from "./decode";

// =============================================================================
// RingThickness
// =============================================================================

/**
 * Per-ring thickness specification.
 *
 * Wire (serde internal tag `"kind"`, camelCase; confirmed verbatim in
 * PresetTemplates/*.json, e.g. classic.json `/soloChart/rings[0]`):
 *   Fixed: `{ "kind": "fixed", "value": 20 }`
 *   Auto:  `{ "kind": "auto" }`
 *
 * `fixed` pins the ring to an exact thickness in points; `auto` lets the
 * `VariableRingSizing` strategy distribute remaining space.
 * Default: `{ kind: "auto" }` (Rust `Default for RingThickness`).
 */
export type RingThickness = { kind: "auto" } | { kind: "fixed"; value: number };

export const RING_THICKNESS_DEFAULT: RingThickness = { kind: "auto" };

/**
 * Tolerant parse. `"fixed"` with a missing/non-finite `value` falls back to
 * `{ kind: "auto" }` (Swift throws there; this mirror defaults).
 */
export function parseRingThickness(v: unknown): RingThickness {
  const o = obj(v);
  if (o.kind === "fixed" && typeof o.value === "number" && Number.isFinite(o.value)) {
    return { kind: "fixed", value: o.value };
  }
  return { kind: "auto" };
}

export function serializeRingThickness(t: RingThickness): unknown {
  return t.kind === "fixed" ? { kind: "fixed", value: t.value } : { kind: "auto" };
}

// =============================================================================
// ColorValue (nested in ChartColors; ring-style tasks reuse it)
// =============================================================================

/**
 * Codable color value.
 *
 * Wire: `{ "source": "semantic" | "hue" | "hex", "value": string, "layer"?: ... }`
 *  - `source "semantic"`: theme token, e.g. value `"primary"`, `"card"`, `"accent"`
 *  - `source "hue"`: a hue token (see ZodiacHues doc for the 14 known tokens)
 *  - `source "hex"`: direct hex, e.g. `"#FF5733"`
 *  - `layer`: `"bg" | "bd" | "ic" | "tx" | "primitive"` — omitted on the wire
 *    when absent (Swift synthesized `encodeIfPresent`; Rust `skip_serializing_if`).
 *
 * Fields are typed `string` for tolerance: unknown tokens pass through
 * untouched. Default: `{ source: "semantic", value: "primary", layer: "ic" }`
 * (Rust `ColorValue::primary_icon()`; Swift `ColorValue(semantic: "primary", layer: .ic)`
 * used by `OtherBodyColors.default` / `AngleColors.default`).
 */
export interface ColorValue {
  source: string;
  value: string;
  layer?: string;
}

export const COLOR_VALUE_DEFAULT: ColorValue = {
  source: "semantic",
  value: "primary",
  layer: "ic",
};

export function parseColorValue(v: unknown): ColorValue {
  const o = obj(v);
  const d = COLOR_VALUE_DEFAULT;
  const source = str(o.source, d.source);
  const value = str(o.value, d.value);
  if (o.layer === undefined || o.layer === null) {
    return d.layer === undefined ? { source, value } : { source, value, layer: d.layer };
  }
  return { source, value, layer: str(o.layer, d.layer ?? "ic") };
}

/** `layer` is omitted when undefined, matching both platforms' encoders. */
export function serializeColorValue(c: ColorValue): unknown {
  return c.layer === undefined
    ? { source: c.source, value: c.value }
    : { source: c.source, value: c.value, layer: c.layer };
}

// =============================================================================
// ChartColors
// =============================================================================

/**
 * Zodiac hue storage.
 *
 * Wire: `{ "variant": string, "signs": string[] }` — NOTE the wire key is
 * `"signs"` (Swift CodingKeys `hues`→`"signs"`; Rust `#[serde(rename = "signs")]`).
 * `signs` is ordered Aries→Pisces and is exactly 12 entries on write (enforced
 * by a Swift precondition); this mirror passes any valid string[] through and
 * only replaces missing/malformed values.
 *
 * Known `variant` values (ZodiacColorVariant): `coloredBackground`,
 * `coloredForeground`, `fullHue`, `subtle`, `minimal`, `greyscale`.
 * Known hue tokens (HueToken): `red orange yellow lime green aqua sky blue
 * indigo purple byzantium magenta gold greyscale`.
 *
 * Default: `{ variant: "minimal", signs: 12 × "greyscale" }`
 * (Swift `ZodiacHues.greyscale`; Rust `ZodiacHues::greyscale()`).
 */
export interface ZodiacHues {
  variant: string;
  signs: string[];
}

/** Color scheme for all 12 zodiac signs. Default: greyscale ZodiacHues. */
export interface ZodiacColorSet {
  zodiacHues: ZodiacHues;
}

/**
 * Planet hue assignments (hue tokens). Defaults (Swift `PlanetHues.default`;
 * Rust `PlanetHues::default()` — identical):
 * sun gold, moon gold, mercury blue, venus byzantium, mars red,
 * jupiter green, saturn orange, uranus sky, neptune indigo, pluto magenta.
 */
export interface PlanetHues {
  sun: string;
  moon: string;
  mercury: string;
  venus: string;
  mars: string;
  jupiter: string;
  saturn: string;
  uranus: string;
  neptune: string;
  pluto: string;
}

/** Colors for non-planet bodies. Default: COLOR_VALUE_DEFAULT. */
export interface OtherBodyColors {
  defaultColor: ColorValue;
}

/** Colors for chart angles (ASC, MC, …). Default: COLOR_VALUE_DEFAULT. */
export interface AngleColors {
  defaultColor: ColorValue;
}

/** Default: `{ planetHues: PlanetHues defaults, otherBodies/angles: COLOR_VALUE_DEFAULT }`. */
export interface CelestialBodyColorSet {
  planetHues: PlanetHues;
  otherBodies: OtherBodyColors;
  angles: AngleColors;
}

/**
 * Complete color configuration for chart rendering.
 *
 * Wire: `{ "zodiacColors": { "zodiacHues": {...} }, "celestialBodyColors":
 * { "planetHues": {...}, "otherBodies": {...}, "angles": {...} } }`
 * (camelCase both platforms).
 *
 * Default: greyscale zodiac (`variant "minimal"`, 12 × `"greyscale"`) +
 * default CelestialBodyColorSet. (Swift `ChartColors.default`; Rust
 * `ChartColors::default()` — identical.)
 *
 * Scope note: aspect hues live on `AspectOverlayStyle`, NOT here — and their
 * wire keys are PascalCase irregulars ("Semisextile", "Semisquare",
 * "Sesquisquare", "MinorAspect"), a Stage 3.5 D10 known exception.
 */
export interface ChartColors {
  zodiacColors: ZodiacColorSet;
  celestialBodyColors: CelestialBodyColorSet;
}

export const CHART_COLORS_DEFAULT: ChartColors = {
  zodiacColors: {
    zodiacHues: {
      variant: "minimal",
      signs: Array.from({ length: 12 }, () => "greyscale"),
    },
  },
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
    otherBodies: { defaultColor: COLOR_VALUE_DEFAULT },
    angles: { defaultColor: COLOR_VALUE_DEFAULT },
  },
};

function parseZodiacHues(v: unknown): ZodiacHues {
  const o = obj(v);
  const d = CHART_COLORS_DEFAULT.zodiacColors.zodiacHues;
  return {
    variant: str(o.variant, d.variant),
    signs: strArr(o.signs, d.signs),
  };
}

function parsePlanetHues(v: unknown): PlanetHues {
  const o = obj(v);
  const d = CHART_COLORS_DEFAULT.celestialBodyColors.planetHues;
  return {
    sun: str(o.sun, d.sun),
    moon: str(o.moon, d.moon),
    mercury: str(o.mercury, d.mercury),
    venus: str(o.venus, d.venus),
    mars: str(o.mars, d.mars),
    jupiter: str(o.jupiter, d.jupiter),
    saturn: str(o.saturn, d.saturn),
    uranus: str(o.uranus, d.uranus),
    neptune: str(o.neptune, d.neptune),
    pluto: str(o.pluto, d.pluto),
  };
}

export function parseChartColors(v: unknown): ChartColors {
  const o = obj(v);
  const d = CHART_COLORS_DEFAULT;
  const zodiac = obj(o.zodiacColors);
  const bodies = obj(o.celestialBodyColors);
  return {
    zodiacColors: {
      zodiacHues: parseZodiacHues(zodiac.zodiacHues),
    },
    celestialBodyColors: {
      planetHues: parsePlanetHues(bodies.planetHues),
      otherBodies: {
        defaultColor: parseColorValue(
          obj(bodies.otherBodies).defaultColor ?? d.celestialBodyColors.otherBodies.defaultColor,
        ),
      },
      angles: {
        defaultColor: parseColorValue(
          obj(bodies.angles).defaultColor ?? d.celestialBodyColors.angles.defaultColor,
        ),
      },
    },
  };
}

export function serializeChartColors(c: ChartColors): unknown {
  return {
    zodiacColors: {
      zodiacHues: {
        variant: c.zodiacColors.zodiacHues.variant,
        signs: [...c.zodiacColors.zodiacHues.signs],
      },
    },
    celestialBodyColors: {
      planetHues: { ...c.celestialBodyColors.planetHues },
      otherBodies: {
        defaultColor: serializeColorValue(c.celestialBodyColors.otherBodies.defaultColor),
      },
      angles: {
        defaultColor: serializeColorValue(c.celestialBodyColors.angles.defaultColor),
      },
    },
  };
}

// =============================================================================
// GlobalChartVariables
// =============================================================================

/**
 * Strategy for distributing thickness across variable-sized rings.
 * Wire: `"equalDistribution" | "explicit"`. Unknown/missing values coerce to
 * `"equalDistribution"` (Swift would hard-throw on an unknown raw value; this
 * mirror deliberately defaults).
 */
export type VariableRingSizing = "equalDistribution" | "explicit";

/**
 * Configuration for planet overlap prevention.
 *
 * Wire: `{ "enabled": boolean, "nudgeDistance": number }` (camelCase both
 * platforms; Stage 3.6 D3 — exactly two fields, Rust test
 * `overlap_prevention_config_has_two_fields_only` pins this).
 * `nudgeDistance` is extra breathing room beyond touching, in points at the
 * design-reference canvas scale.
 *
 * Default: `{ enabled: true, nudgeDistance: 0.0 }` — see the drift record on
 * OVERLAP_PREVENTION_DEFAULT.
 */
export interface OverlapPreventionConfig {
  enabled: boolean;
  nudgeDistance: number;
}

/**
 * DRIFT RECORD (adjudicated 2026-08-13, controller ruling — Swift wins):
 * Rust `styles.rs:201` (`OverlapPreventionConfig::default()`) still defaults
 * `nudgeDistance` to **8.0** — stale; never updated after the iOS regression
 * repair. The 8.0 was the broken-era bundled default (PR #151 follow-up,
 * a59b33ef); Swift's `OverlapPreventionNudgeMigration` exists precisely to
 * rewrite stored 8.0 → 0.0, and declares 0.0 the restored default
 * (`OverlapPreventionConfigV3.default`, PlanetsRingStyle.swift:53). Bundled
 * templates never write 8 at `globalSettings` scope (they write 0/1/2/4
 * explicitly). Rust's 8.0 is also unreachable via decode — that struct field
 * carries no `#[serde(default)]`, so a missing key hard-errors there.
 * Swift + templates + this mirror use **0.0**. The same default applies to
 * `PlanetsRingStyle.overlapPrevention` (ring-styles task) — one ruling, two
 * call sites.
 */
export const OVERLAP_PREVENTION_DEFAULT: OverlapPreventionConfig = {
  enabled: true,
  nudgeDistance: 0.0,
};

/**
 * Global canvas-level chart layout variables. All measurements in points.
 *
 * Wire (camelCase both platforms; confirmed verbatim in
 * PresetTemplates/classic.json `/soloChart/globalSettings`):
 *  - margin: number — margin around the entire wheel. Default 8.
 *  - minimumInnerRadius: number — min radius of the center hole. Default 60.
 *  - ringGap: number — gap between adjacent rings. Default 0.
 *  - variableRingSizing: VariableRingSizing. Default "equalDistribution".
 *  - defaultHitRadius: number — default tap-target radius. Default 20.
 *  - moduleHitRadiusOverrides: { [module]: number } — per-module hit-radius
 *    overrides; keys "zodiacRing" | "planetsRing" | "houses". Default {}.
 *  - staticOrientationDegree: number — static orientation (0–360). Default 0.
 *  - overlapPrevention: OverlapPreventionConfig — cross-ring default.
 *    Default OVERLAP_PREVENTION_DEFAULT.
 *
 * (Swift `GlobalChartVariables.default`; Rust `GlobalChartVariables::default()` —
 * identical except the adjudicated overlapPrevention.nudgeDistance drift.)
 */
export interface GlobalChartVariables {
  margin: number;
  minimumInnerRadius: number;
  ringGap: number;
  variableRingSizing: VariableRingSizing;
  defaultHitRadius: number;
  moduleHitRadiusOverrides: Record<string, number>;
  staticOrientationDegree: number;
  overlapPrevention: OverlapPreventionConfig;
}

export const GLOBAL_CHART_VARIABLES_DEFAULT: GlobalChartVariables = {
  margin: 8.0,
  minimumInnerRadius: 60.0,
  ringGap: 0.0,
  variableRingSizing: "equalDistribution",
  defaultHitRadius: 20.0,
  moduleHitRadiusOverrides: {},
  staticOrientationDegree: 0.0,
  overlapPrevention: OVERLAP_PREVENTION_DEFAULT,
};

/** Exported for `PlanetsRingStyle.overlapPrevention` (ring-styles.ts) — one ruling, two call sites. */
export function parseOverlapPrevention(v: unknown): OverlapPreventionConfig {
  const o = obj(v);
  return {
    enabled: bool(o.enabled, OVERLAP_PREVENTION_DEFAULT.enabled),
    nudgeDistance: num(o.nudgeDistance, OVERLAP_PREVENTION_DEFAULT.nudgeDistance),
  };
}

export function serializeOverlapPrevention(c: OverlapPreventionConfig): unknown {
  return { enabled: c.enabled, nudgeDistance: c.nudgeDistance };
}

/** Unknown keys pass through; non-finite-number values drop out. */
function parseHitRadiusOverrides(v: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, val] of Object.entries(obj(v))) {
    if (typeof val === "number" && Number.isFinite(val)) out[key] = val;
  }
  return out;
}

export function parseGlobalChartVariables(v: unknown): GlobalChartVariables {
  const o = obj(v);
  const d = GLOBAL_CHART_VARIABLES_DEFAULT;
  return {
    margin: num(o.margin, d.margin),
    minimumInnerRadius: num(o.minimumInnerRadius, d.minimumInnerRadius),
    ringGap: num(o.ringGap, d.ringGap),
    variableRingSizing:
      o.variableRingSizing === "explicit" ? "explicit" : d.variableRingSizing,
    defaultHitRadius: num(o.defaultHitRadius, d.defaultHitRadius),
    moduleHitRadiusOverrides: parseHitRadiusOverrides(o.moduleHitRadiusOverrides),
    staticOrientationDegree: num(o.staticOrientationDegree, d.staticOrientationDegree),
    overlapPrevention: parseOverlapPrevention(o.overlapPrevention),
  };
}

export function serializeGlobalChartVariables(g: GlobalChartVariables): unknown {
  return {
    margin: g.margin,
    minimumInnerRadius: g.minimumInnerRadius,
    ringGap: g.ringGap,
    variableRingSizing: g.variableRingSizing,
    defaultHitRadius: g.defaultHitRadius,
    moduleHitRadiusOverrides: { ...g.moduleHitRadiusOverrides },
    staticOrientationDegree: g.staticOrientationDegree,
    overlapPrevention: serializeOverlapPrevention(g.overlapPrevention),
  };
}

// =============================================================================
// VisibilityConfiguration
// =============================================================================

/**
 * The preset-wide set of celestial bodies to display (consistent across
 * solo/dual/triple ring variants).
 *
 * Wire: `{ "enabledBodies": string[] }` — the strings are CelestialBody
 * *display names* ("Sun", "North Node", "Imum Coeli"), NOT the camelCase ids
 * of enums.gen.ts; map via `CELESTIAL_BODIES[*].displayName` inverse lookup
 * (e.g. "North Node" → "rahu"). Confirmed verbatim in
 * PresetTemplates/classic.json `/visibility`.
 *
 * Default: `[]` — mirrors Swift `VisibilityConfiguration.minimal` (empty set),
 * which `PresetWireFormat.swift:121` uses as its `?? .minimal` fallback. Rust
 * has no counterpart type (visibility moved preset-wide to the Swift side), so
 * Swift is the sole authority here.
 *
 * Unknown body strings pass through untouched. (Swift's synthesized Codable
 * would throw the whole blob on an unknown raw value — Preset.swift guards
 * with `try?` — this mirror is deliberately more tolerant.)
 */
export interface VisibilityConfiguration {
  enabledBodies: string[];
}

export const VISIBILITY_CONFIGURATION_DEFAULT: VisibilityConfiguration = {
  enabledBodies: [],
};

export function parseVisibilityConfiguration(v: unknown): VisibilityConfiguration {
  return { enabledBodies: strArr(obj(v).enabledBodies, []) };
}

export function serializeVisibilityConfiguration(c: VisibilityConfiguration): unknown {
  return { enabledBodies: [...c.enabledBodies] };
}
