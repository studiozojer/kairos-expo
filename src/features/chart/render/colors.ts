/**
 * Color resolution — schema `ColorValue` → a hex string Skia accepts
 * (`#RRGGBBAA`; Skia's JS and native C++ CSSColorParser both read it —
 * cpp/api/third_party/CSSColorParser.cpp:111).
 *
 * THE RESOLUTION RULE (mirrors kairos-ios's two-step, app-side bridge):
 *
 *  - source "hex" → the value verbatim (iOS `Color(hex:)`).
 *
 *  - source "semantic" → iOS maps (value, layer) to an asset-catalog name via
 *    `UIColor.tx/ic/bg/bd(_ token:)` (Core/Extensions/SwiftUI+Color.swift);
 *    kairos-expo's equivalent catalog is daoUI's tokens, reached through
 *    `useTheme()` (`theme.color`, light/dark already resolved). Compose the
 *    daoUI role key `<layer><Value>` with iOS's special cases first:
 *      bg+card → bgSolidCard, bg+base → bgSolidBase, bg+button → bgSolidButton
 *      (iOS's bg switch routes those values to the "bg/solid/*" assets),
 *      bd+base → bdBase, bd+card → bdCard.
 *    Unknown semantic VALUES collapse to "primary" first (ColorTypes.swift's
 *    `default: token = .primary`). A composed key that isn't a synced role
 *    (e.g. "bgSolidAccent" — iOS has bg/solid/accent, daoUI doesn't publish it
 *    here) falls to the layer's primary — iOS's per-layer `default:` arm
 *    (bg/bd/ic/tx → <layer>/primary). semantic+primitive → icPrimary (iOS:
 *    `.ic(.primary)`, "shouldn't happen"). Unknown LAYER → treated as "ic"
 *    (the schema's COLOR_VALUE_DEFAULT layer).
 *
 *  - source "hue" → daoUI publishes NO hue tokens (tokens.gen.ts: 37 roles,
 *    none of them hues), so the palette is ported into this feature from
 *    kairos-ios's Assets.xcassets (`<layer>/hue/<token>.colorset`): the
 *    primitive RGB per token (theme-adaptive ONLY for greyscale — #808080
 *    light / #999999 dark) × the layer's alpha (bg .5 / bd .35 / ic .9 /
 *    tx .95 / primitive 1.0 — verified in the colorsets 2026-08-14).
 *    SPECIAL CASE (kairos-ios HueToken+Colors.swift): hue "greyscale" at
 *    layers bg/bd/ic/tx never touches the greyscale asset — it routes to the
 *    layer's SEMANTIC primary. Unknown hue token → "red" (iOS
 *    `HueToken(rawValue:) ?? .red`, ColorTypes.swift).
 *
 *  TASK 9 NOTE — two iOS paths disagree on hue+primitive+greyscale:
 *  `ColorValue.color` (this file's model) resolves to the theme-adaptive
 *  greyscale asset; `HueToken.primitive()` (used by PlanetHues.color(for:),
 *  the PLANET glyph path) routes greyscale → ic/primary instead. Planet
 *  colors should follow the PlanetHues path, not resolveColorValue.
 *
 * Dark mode: iOS resolves dynamic colors via `resolvedColor(with:)` against
 * the Canvas's colorScheme (SVGRenderer.swift:32-43); here `theme` is already
 * scheme-resolved, so resolution below is scheme-final. One wrinkle: Skia's
 * Canvas renders children in its OWN react-reconciler root, so app React
 * context (the theme-mode override) does not reach ring components —
 * ChartWheel reads `useTheme()` OUTSIDE the Canvas and re-provides it through
 * ChartPaintContext INSIDE the Canvas subtree.
 */

import { createContext, useContext } from "react";

import type { Theme } from "@/theme";

import type { ChartColors, ColorValue } from "../schema/core-types";

// ---------------------------------------------------------------------------
// Hue palette — kairos-ios Assets.xcassets primitive/hue/*.colorset
// (14 HueToken cases; RGB identical across appearances except greyscale).
// ---------------------------------------------------------------------------

const HUE_PRIMITIVES: Record<string, { light: string; dark: string }> = {
  red: { light: "#e34837", dark: "#e34837" },
  orange: { light: "#e48a2e", dark: "#e48a2e" },
  yellow: { light: "#efc429", dark: "#efc429" },
  lime: { light: "#dce232", dark: "#dce232" },
  green: { light: "#86c543", dark: "#86c543" },
  aqua: { light: "#5dd5ab", dark: "#5dd5ab" },
  sky: { light: "#48bfe0", dark: "#48bfe0" },
  blue: { light: "#2a84d7", dark: "#2a84d7" },
  indigo: { light: "#2a50d7", dark: "#2a50d7" },
  purple: { light: "#7c56ee", dark: "#7c56ee" },
  byzantium: { light: "#a84fc8", dark: "#a84fc8" },
  magenta: { light: "#cd4293", dark: "#cd4293" },
  gold: { light: "#f7b667", dark: "#f7b667" },
  greyscale: { light: "#808080", dark: "#999999" },
};

/** Layer alphas from kairos-ios's <layer>/hue/*.colorset (verified 2026-08-14). */
const LAYER_ALPHA: Record<string, string> = {
  bg: "80", // 0.500
  bd: "59", // 0.350
  ic: "e6", // 0.900
  tx: "f2", // 0.950
  primitive: "ff", // 1.000
};

/** iOS's known semantic values (ColorTypes.swift's value switch). */
const SEMANTIC_VALUES = new Set([
  "primary",
  "secondary",
  "tertiary",
  "card",
  "base",
  "accent",
  "accent-opaque",
  "solid-accent",
  "button",
  "error",
  "warning",
  "success",
  "disabled",
]);

/** iOS's per-layer `default:` arms + the semantic+primitive case. */
const LAYER_FALLBACK_ROLE: Record<string, keyof Theme["color"]> = {
  bg: "bgPrimary",
  bd: "bdPrimary",
  ic: "icPrimary",
  tx: "txPrimary",
  primitive: "icPrimary",
};

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** (value, layer) → daoUI role key, with iOS's solid-routing special cases. */
function semanticRoleKey(value: string, layer: string): string {
  if (layer === "bg") {
    if (value === "card") return "bgSolidCard";
    if (value === "base") return "bgSolidBase";
    if (value === "button") return "bgSolidButton";
    if (value === "accent-opaque" || value === "solid-accent") return "bgSolidAccent";
  }
  if (layer === "bd") {
    if (value === "base") return "bdBase";
    if (value === "card") return "bdCard";
  }
  return `${layer}${capitalize(value)}`;
}

function resolveSemantic(cv: ColorValue, theme: Theme): string {
  const layer = cv.layer ?? "ic";
  if (layer === "primitive") return theme.color.icPrimary;
  const safeLayer = layer in LAYER_FALLBACK_ROLE && layer !== "primitive" ? layer : "ic";
  const value = SEMANTIC_VALUES.has(cv.value) ? cv.value : "primary";
  const key = semanticRoleKey(value, safeLayer) as keyof Theme["color"];
  return theme.color[key] ?? theme.color[LAYER_FALLBACK_ROLE[safeLayer]];
}

function resolveHue(cv: ColorValue, theme: Theme): string {
  const layer = cv.layer ?? "ic";
  // HueToken+Colors.swift: greyscale at the adaptive layers is semantic primary.
  if (cv.value === "greyscale" && layer !== "primitive") {
    const role = LAYER_FALLBACK_ROLE[layer] ?? "icPrimary";
    return theme.color[role];
  }
  const safeLayer = layer in LAYER_ALPHA ? layer : "ic";
  const hue = HUE_PRIMITIVES[cv.value] ?? HUE_PRIMITIVES.red; // iOS `?? .red`
  return `${hue[theme.scheme]}${LAYER_ALPHA[safeLayer]}`;
}

/** Total: every ColorValue resolves; unknowns take iOS's documented fallbacks. */
export function resolveColorValue(cv: ColorValue, theme: Theme): string {
  switch (cv.source) {
    case "hex":
      return cv.value;
    case "hue":
      return resolveHue(cv, theme);
    case "semantic":
      return resolveSemantic(cv, theme);
    default:
      // The schema passes unknown sources through tolerantly; iOS has no such
      // case (exhaustive enum). The schema default's source is "semantic" —
      // treat unknowns the same so a typo degrades to a theme color.
      return resolveSemantic({ ...cv, source: "semantic" }, theme);
  }
}

// ---------------------------------------------------------------------------
// SignColors — port of KairosCore ZodiacHues.colors(for:) = variant.applyHue
// (ColorSets.swift:112-146). Returns the three layer ColorValues for a sign;
// callers resolve them (or the ring style's overrides) with resolveColorValue.
// ---------------------------------------------------------------------------

export interface SignColorValues {
  background: ColorValue;
  border: ColorValue;
  icon: ColorValue;
}

function applyHueVariant(variant: string, hue: string): SignColorValues {
  const hueBg: ColorValue = { source: "hue", value: hue, layer: "bg" };
  const hueBd: ColorValue = { source: "hue", value: hue, layer: "bd" };
  const hueIc: ColorValue = { source: "hue", value: hue, layer: "ic" };
  const cardBg: ColorValue = { source: "semantic", value: "card", layer: "bg" };
  const primaryBd: ColorValue = { source: "semantic", value: "primary", layer: "bd" };
  const primaryIc: ColorValue = { source: "semantic", value: "primary", layer: "ic" };

  switch (variant) {
    case "coloredBackground":
      return { background: hueBg, border: hueBd, icon: primaryIc };
    case "coloredForeground":
    case "minimal":
      return { background: cardBg, border: primaryBd, icon: hueIc };
    case "fullHue":
      return { background: hueBg, border: hueBd, icon: hueIc };
    case "subtle":
      return { background: cardBg, border: hueBd, icon: hueIc };
    case "greyscale":
      return { background: cardBg, border: primaryBd, icon: primaryIc };
    default:
      // Swift decodes variant as an enum — an unknown value fails the whole
      // preset blob there. The TS schema tolerantly passes the string through,
      // so render takes the safest monochrome reading: greyscale.
      return { background: cardBg, border: primaryBd, icon: primaryIc };
  }
}

/** Sign index 0 = Aries … 11 = Pisces (ZodiacHues.hue(for:) order). */
export function signColorValues(colors: ChartColors, signIndex: number): SignColorValues {
  const hues = colors.zodiacColors.zodiacHues;
  // iOS hue(for:) falls back to .red when the array is short (a precondition
  // guards 12 on write; the TS schema passes malformed lengths through).
  const hue = hues.signs[signIndex] ?? "red";
  return applyHueVariant(hues.variant, hue);
}

// ---------------------------------------------------------------------------
// ChartPaintContext — the theme, re-provided INSIDE Skia's Canvas subtree
// (Skia's reconciler root does not inherit the app's React context; see the
// module header). ChartWheel provides it; ring components consume it.
// ---------------------------------------------------------------------------

const ChartPaintContext = createContext<Theme | null>(null);

/** Theme for chart paint resolution. Ring renderers only mount inside
 *  <ChartWheel> (which provides the context) — anything else is a bug, so
 *  this throws rather than silently picking a scheme. */
export function useChartPaintTheme(): Theme {
  const ctx = useContext(ChartPaintContext);
  if (!ctx) {
    throw new Error(
      "useChartPaintTheme: no ChartPaintContext — ring renderers must render inside <ChartWheel>.",
    );
  }
  return ctx;
}

export const ChartPaintProvider = ChartPaintContext.Provider;
