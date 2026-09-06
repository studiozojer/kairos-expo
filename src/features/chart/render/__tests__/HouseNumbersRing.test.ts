/**
 * HouseNumbersRing unit tests (Task 10) — the exported pure helpers, same
 * pattern as PlanetsRing.render.test.tsx's direct tests of `cuspLineColor`/
 * `boundaryLineColor`/`defaultGlyphColor`.
 */

import { themeFor } from "@/theme";

import { HOUSES_RING_STYLE_DEFAULT, type HousesRingStyle } from "../../schema/ring-styles";
import {
  boundaryLineColor,
  cuspLineColor,
  isAngularHouse,
  toRomanNumeral,
} from "../rings/HouseNumbersRing";

const lightTheme = themeFor("light");

test("toRomanNumeral is Swift's misnomer: decimal 1-12, not roman numerals", () => {
  expect(toRomanNumeral(1)).toBe("1");
  expect(toRomanNumeral(4)).toBe("4");
  expect(toRomanNumeral(12)).toBe("12");
});

test("isAngularHouse: houses 1, 4, 7, 10 are angular; the rest are not", () => {
  expect([1, 4, 7, 10].every(isAngularHouse)).toBe(true);
  expect([2, 3, 5, 6, 8, 9, 11, 12].some(isAngularHouse)).toBe(false);
});

test("cuspLineColor: angular cusp prefers angularCuspLineColor over cuspLineColor", () => {
  const style: HousesRingStyle = {
    ...HOUSES_RING_STYLE_DEFAULT,
    angularCuspLineColor: { source: "hex", value: "#111111" },
    cuspLineColor: { source: "hex", value: "#222222" },
  };
  expect(cuspLineColor(true, style, lightTheme)).toBe("#111111");
  expect(cuspLineColor(false, style, lightTheme)).toBe("#222222");
});

test("cuspLineColor: falls back to cuspLineColor, then bd/primary", () => {
  const withCuspOnly: HousesRingStyle = {
    ...HOUSES_RING_STYLE_DEFAULT,
    angularCuspLineColor: undefined,
    cuspLineColor: { source: "hex", value: "#333333" },
  };
  expect(cuspLineColor(true, withCuspOnly, lightTheme)).toBe("#333333");

  const withNeither: HousesRingStyle = {
    ...HOUSES_RING_STYLE_DEFAULT,
    angularCuspLineColor: undefined,
    cuspLineColor: undefined,
  };
  expect(cuspLineColor(true, withNeither, lightTheme)).toBe(lightTheme.color.bdPrimary);
  expect(cuspLineColor(false, withNeither, lightTheme)).toBe(lightTheme.color.bdPrimary);
});

test("boundaryLineColor: style override, else bd/primary", () => {
  const withOverride: HousesRingStyle = {
    ...HOUSES_RING_STYLE_DEFAULT,
    boundaryLineColor: { source: "hex", value: "#abcdef" },
  };
  expect(boundaryLineColor(withOverride, lightTheme)).toBe("#abcdef");
  expect(boundaryLineColor(HOUSES_RING_STYLE_DEFAULT, lightTheme)).toBe(lightTheme.color.bdPrimary);
});
