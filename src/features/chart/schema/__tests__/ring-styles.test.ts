import {
  OVERLAP_PREVENTION_DEFAULT,
  parseRingThickness,
} from "../core-types";
import {
  ASPECT_OVERLAY_STYLE_DEFAULT,
  ASPECTS_STYLE_TYPE,
  CUSP_ANNOTATIONS_STYLE_DEFAULT,
  CUSP_ANNOTATIONS_STYLE_TYPE,
  DECANS_STYLE_DEFAULT,
  DECANS_STYLE_TYPE,
  FIXED_STARS_STYLE_DEFAULT,
  FIXED_STARS_STYLE_TYPE,
  HOUSES_RING_STYLE_DEFAULT,
  HOUSES_STYLE_TYPE,
  LUNAR_MANSIONS_STYLE_DEFAULT,
  LUNAR_MANSIONS_STYLE_TYPE,
  PLANETS_RING_STYLE_DEFAULT,
  PLANETS_STYLE_TYPE,
  SIGN_RULERS_STYLE_DEFAULT,
  SIGN_RULERS_STYLE_TYPE,
  TERMS_STYLE_DEFAULT,
  TERMS_STYLE_TYPE,
  ZODIAC_RING_STYLE_DEFAULT,
  ZODIAC_STYLE_TYPE,
  defaultRingStyle,
  parseRingStyle,
  serializeRingStyle,
} from "../ring-styles";
import {
  ASPECT_ORBS_DEFAULT,
  ASPECTS_CONTENT_TYPE,
  ASPECTS_RING_CONTENT_DEFAULT,
  CUSP_ANNOTATIONS_CONTENT_TYPE,
  DECANS_CONTENT_TYPE,
  FIXED_STARS_CONTENT_TYPE,
  HOUSES_CONTENT_TYPE,
  HOUSES_RING_CONTENT_DEFAULT,
  LUNAR_MANSIONS_CONTENT_TYPE,
  PLANETS_CONTENT_TYPE,
  PLANETS_RING_CONTENT_DEFAULT,
  SIGN_RULERS_CONTENT_TYPE,
  TERMS_CONTENT_TYPE,
  TERMS_RING_CONTENT_DEFAULT,
  ZODIAC_CONTENT_TYPE,
  ZODIAC_RING_CONTENT_DEFAULT,
  parseRingContent,
  serializeRingContent,
} from "../ring-content";
import { parseRingModule, serializeRingModule } from "../ring-module";

// Wire shapes cited from kairos-engine PresetTemplates (verified 2026-08-14):
// classic.json (zodiac/planets/houses rings + preset-level aspectOverlay),
// study.json (decans, lunarMansions), traditional.json (signRulers),
// starfield.json (fixedStars), minimal.json (cuspAnnotations).
// No template carries a terms ring — terms asserts defaults + explicit fields.

// ---------------------------------------------------------------------------
// $type NSID constants (verbatim from RingStyle.swift / RingContent.swift)
// ---------------------------------------------------------------------------

test("style $type constants match RingStyle.swift TypeID", () => {
  expect(ZODIAC_STYLE_TYPE).toBe("solar.kairos.preset.ring.style.zodiac");
  expect(PLANETS_STYLE_TYPE).toBe("solar.kairos.preset.ring.style.planets");
  expect(HOUSES_STYLE_TYPE).toBe("solar.kairos.preset.ring.style.houses");
  expect(ASPECTS_STYLE_TYPE).toBe("solar.kairos.preset.ring.style.aspects");
  expect(DECANS_STYLE_TYPE).toBe("solar.kairos.preset.ring.style.decans");
  expect(SIGN_RULERS_STYLE_TYPE).toBe("solar.kairos.preset.ring.style.signRulers");
  expect(TERMS_STYLE_TYPE).toBe("solar.kairos.preset.ring.style.terms");
  expect(LUNAR_MANSIONS_STYLE_TYPE).toBe("solar.kairos.preset.ring.style.lunarMansions");
  expect(FIXED_STARS_STYLE_TYPE).toBe("solar.kairos.preset.ring.style.fixedStars");
  expect(CUSP_ANNOTATIONS_STYLE_TYPE).toBe("solar.kairos.preset.ring.style.cuspAnnotations");
});

test("content $type constants match RingContent.swift TypeID", () => {
  expect(ZODIAC_CONTENT_TYPE).toBe("solar.kairos.preset.ring.content.zodiac");
  expect(PLANETS_CONTENT_TYPE).toBe("solar.kairos.preset.ring.content.planets");
  expect(HOUSES_CONTENT_TYPE).toBe("solar.kairos.preset.ring.content.houses");
  expect(ASPECTS_CONTENT_TYPE).toBe("solar.kairos.preset.ring.content.aspects");
  expect(DECANS_CONTENT_TYPE).toBe("solar.kairos.preset.ring.content.decans");
  expect(SIGN_RULERS_CONTENT_TYPE).toBe("solar.kairos.preset.ring.content.signRulers");
  expect(TERMS_CONTENT_TYPE).toBe("solar.kairos.preset.ring.content.terms");
  expect(LUNAR_MANSIONS_CONTENT_TYPE).toBe("solar.kairos.preset.ring.content.lunarMansions");
  expect(FIXED_STARS_CONTENT_TYPE).toBe("solar.kairos.preset.ring.content.fixedStars");
  expect(CUSP_ANNOTATIONS_CONTENT_TYPE).toBe("solar.kairos.preset.ring.content.cuspAnnotations");
});

// ---------------------------------------------------------------------------
// PlanetsRingStyle
// ---------------------------------------------------------------------------

test("legacy keys decode into current fields", () => {
  const s = parseRingStyle({ $type: PLANETS_STYLE_TYPE, glyphInsetFromTicks: 14 }, "planets");
  expect(s.$type).toBe(PLANETS_STYLE_TYPE);
  if (s.$type === PLANETS_STYLE_TYPE) expect(s.glyphInsetFromAnchor).toBe(14);
});

test("elementsFromInnerEdge legacy alias decodes into anchorFromInnerEdge", () => {
  const s = parseRingStyle({ $type: PLANETS_STYLE_TYPE, elementsFromInnerEdge: false }, "planets");
  expect(s.$type).toBe(PLANETS_STYLE_TYPE);
  if (s.$type === PLANETS_STYLE_TYPE) expect(s.anchorFromInnerEdge).toBe(false);
});

test("current key wins over legacy key when both present", () => {
  const s = parseRingStyle(
    {
      $type: PLANETS_STYLE_TYPE,
      glyphInsetFromAnchor: 9,
      glyphInsetFromTicks: 14,
      anchorFromInnerEdge: true,
      elementsFromInnerEdge: false,
    },
    "planets",
  );
  if (s.$type === PLANETS_STYLE_TYPE) {
    expect(s.glyphInsetFromAnchor).toBe(9);
    expect(s.anchorFromInnerEdge).toBe(true);
  } else {
    throw new Error("expected planets style");
  }
});

test("unknown $type degrades to the ring type's default style", () => {
  const s = parseRingStyle({ $type: "solar.kairos.preset.ring.style.nonsense" }, "planets");
  expect(s).toEqual(PLANETS_RING_STYLE_DEFAULT);
});

test("missing $type / non-object degrades to the ring type's default style", () => {
  expect(parseRingStyle({ glyphSize: 30 }, "zodiac")).toEqual(ZODIAC_RING_STYLE_DEFAULT);
  expect(parseRingStyle(null, "terms")).toEqual(TERMS_STYLE_DEFAULT);
  expect(parseRingStyle("blob", "houses")).toEqual(HOUSES_RING_STYLE_DEFAULT);
  // Unknown ring type falls back to zodiac (Swift RingModuleEntity.toWireFormat `?? .zodiac`).
  expect(parseRingStyle(undefined, "nonsense")).toEqual(ZODIAC_RING_STYLE_DEFAULT);
});

test("empty planets blob parses to the default (Swift decode defaults)", () => {
  const s = parseRingStyle({ $type: PLANETS_STYLE_TYPE }, "planets");
  expect(s).toEqual(PLANETS_RING_STYLE_DEFAULT);
  // Adjudicated decode defaults (Swift): degree/minute text OFF, anchor from
  // inner edge ON (Rust agrees on the latter post-Phase-4-Axis-3).
  if (s.$type === PLANETS_STYLE_TYPE) {
    expect(s.showDegreeText).toBe(false);
    expect(s.showMinuteText).toBe(false);
    expect(s.anchorFromInnerEdge).toBe(true);
    expect(s.overlapPrevention).toEqual(OVERLAP_PREVENTION_DEFAULT);
    expect(s.overlapPrevention.nudgeDistance).toBe(0.0);
  }
});

test("malformed planets fields fall back per-field, never throw", () => {
  const s = parseRingStyle(
    {
      $type: PLANETS_STYLE_TYPE,
      glyphSize: "huge",
      useGlyphs: 1,
      glyphInsetFromAnchor: NaN,
      overlapPrevention: "broken",
      glyphColor: "not-a-color",
    },
    "planets",
  );
  if (s.$type === PLANETS_STYLE_TYPE) {
    expect(s.glyphSize).toBe(18);
    expect(s.useGlyphs).toBe(true);
    expect(s.glyphInsetFromAnchor).toBe(8);
    expect(s.overlapPrevention).toEqual(OVERLAP_PREVENTION_DEFAULT);
    expect(s.glyphColor).toBeUndefined();
  } else {
    throw new Error("expected planets style");
  }
});

test("parses classic.json solo planets style verbatim", () => {
  // PresetTemplates/classic.json /soloChart/rings[1]/style (verified 2026-08-14).
  const wire = {
    $type: "solar.kairos.preset.ring.style.planets",
    anchorFromInnerEdge: true,
    angularCuspLineWidth: 1,
    circleRadius: 8,
    connectionLineWidth: 0.5,
    cuspLineWidth: 0.5,
    degreeMarkLength: 4,
    degreeMarkWidth: 1,
    degreeTextFontSize: 10,
    degreeTextLineSpacing: 3,
    degreeTextOffset: 4,
    glyphInsetFromAnchor: 20,
    glyphSize: 18,
    innerBoundaryLineWidth: 0,
    invertGlyphOrder: true,
    outerBoundaryLineWidth: 0,
    overlapPrevention: { enabled: true, nudgeDistance: 8 },
    showConnectionOnBothEdges: false,
    showCuspLines: true,
    showDegreeMarks: false,
    showDegreeText: true,
    showFrameDerivedPoints: true,
    showMinuteText: false,
    showRetrogradeGlyph: false,
    showSignGlyph: false,
    showTicksOnBothEdges: false,
    thickAngularLines: false,
    useGlyphs: true,
  };
  const s = parseRingStyle(wire, "planets");
  expect(s).toEqual({
    $type: PLANETS_STYLE_TYPE,
    useGlyphs: true,
    showFrameDerivedPoints: true,
    glyphSize: 18,
    showSignGlyph: false,
    showRetrogradeGlyph: false,
    glyphColor: undefined,
    circleRadius: 8,
    showDegreeText: true,
    showMinuteText: false,
    degreeTextFontSize: 10,
    degreeTextOffset: 4,
    degreeTextLineSpacing: 3,
    degreeTextColor: undefined,
    signGlyphColor: undefined,
    showDegreeMarks: false,
    degreeMarkLength: 4,
    degreeMarkWidth: 1,
    connectionLineWidth: 0.5,
    glyphInsetFromAnchor: 20,
    anchorFromInnerEdge: true,
    invertGlyphOrder: true,
    showTicksOnBothEdges: false,
    showConnectionOnBothEdges: false,
    backgroundColor: undefined,
    boundaryLineColor: undefined,
    innerBoundaryLineWidth: 0,
    outerBoundaryLineWidth: 0,
    overlapPrevention: { enabled: true, nudgeDistance: 8 },
    showCuspLines: true,
    cuspLineWidth: 0.5,
    thickAngularLines: false,
    angularCuspLineWidth: 1,
    cuspLineColor: undefined,
    angularCuspLineColor: undefined,
  });
});

test("planets style serialize round-trips through parse (fixed point), omits absent optionals", () => {
  const wire = {
    $type: PLANETS_STYLE_TYPE,
    glyphSize: 22,
    glyphColor: { source: "hue", value: "red", layer: "ic" },
    overlapPrevention: { enabled: false, nudgeDistance: 3 },
  };
  const s = parseRingStyle(wire, "planets");
  expect(parseRingStyle(serializeRingStyle(s), "planets")).toEqual(s);
  const out = serializeRingStyle(s) as Record<string, unknown>;
  expect(out.$type).toBe(PLANETS_STYLE_TYPE);
  expect(out.glyphColor).toEqual({ source: "hue", value: "red", layer: "ic" });
  expect(out.overlapPrevention).toEqual({ enabled: false, nudgeDistance: 3 });
  // Optional colors that were absent stay absent (Swift encodeIfPresent /
  // Rust skip_serializing_if) — backgroundColor etc. must not appear.
  expect("backgroundColor" in out).toBe(false);
  expect("degreeTextColor" in out).toBe(false);
});

// ---------------------------------------------------------------------------
// ZodiacRingStyle
// ---------------------------------------------------------------------------

test("parses classic.json solo zodiac style verbatim", () => {
  // PresetTemplates/classic.json /soloChart/rings[0]/style (verified 2026-08-14).
  const wire = {
    $type: "solar.kairos.preset.ring.style.zodiac",
    glyphSize: 15,
    majorMarkInterval: 10,
    majorMarkLength: 8,
    majorMarkWidth: 0.5,
    minorMarkInterval: 1,
    minorMarkLength: 4,
    minorMarkWidth: 0.5,
    radialLineWidth: 0.5,
    rotateGlyphs: true,
    segmentBorderWidth: 1,
    showDegreeMarkers: false,
  };
  const s = parseRingStyle(wire, "zodiac");
  expect(s).toEqual({
    $type: ZODIAC_STYLE_TYPE,
    glyphSize: 15,
    rotateGlyphs: true,
    glyphColor: undefined,
    segmentBorderWidth: 1,
    radialLineWidth: 0.5,
    segmentBorderColor: undefined,
    radialLineColor: undefined,
    backgroundColor: undefined,
    showDegreeMarkers: false,
    majorMarkInterval: 10,
    minorMarkInterval: 1,
    majorMarkLength: 8,
    minorMarkLength: 4,
    majorMarkWidth: 0.5,
    minorMarkWidth: 0.5,
  });
});

test("empty zodiac blob parses to the default (degree markers OFF per Swift)", () => {
  const s = parseRingStyle({ $type: ZODIAC_STYLE_TYPE }, "zodiac");
  expect(s).toEqual(ZODIAC_RING_STYLE_DEFAULT);
  if (s.$type === ZODIAC_STYLE_TYPE) expect(s.showDegreeMarkers).toBe(false);
});

// ---------------------------------------------------------------------------
// HousesRingStyle
// ---------------------------------------------------------------------------

test("parses classic.json solo houses style verbatim", () => {
  // PresetTemplates/classic.json /soloChart/rings[2]/style (verified 2026-08-14).
  const wire = {
    $type: "solar.kairos.preset.ring.style.houses",
    angularCuspLineWidth: 1,
    boundaryLineColor: { layer: "bd", source: "semantic", value: "primary" },
    cuspLineWidth: 0.5,
    innerBoundaryLineWidth: 0.5,
    numberFontSize: 10,
    numberFontWeight: "regular",
    outerBoundaryLineWidth: 0.5,
    rotateNumbers: true,
    thickAngularLines: false,
  };
  const s = parseRingStyle(wire, "houses");
  expect(s).toEqual({
    $type: HOUSES_STYLE_TYPE,
    numberFontSize: 10,
    numberFontWeight: "regular",
    rotateNumbers: true,
    cuspLineWidth: 0.5,
    angularCuspLineWidth: 1,
    thickAngularLines: false,
    cuspLineColor: undefined,
    angularCuspLineColor: undefined,
    extendCuspsToRing: undefined,
    backgroundColor: undefined,
    innerBoundaryLineWidth: 0.5,
    outerBoundaryLineWidth: 0.5,
    boundaryLineColor: { source: "semantic", value: "primary", layer: "bd" },
  });
});

test("legacy boundaryLineWidth seeds both concentric edges (houses)", () => {
  const s = parseRingStyle({ $type: HOUSES_STYLE_TYPE, boundaryLineWidth: 2 }, "houses");
  if (s.$type === HOUSES_STYLE_TYPE) {
    expect(s.innerBoundaryLineWidth).toBe(2);
    expect(s.outerBoundaryLineWidth).toBe(2);
  } else {
    throw new Error("expected houses style");
  }
});

test("current inner/outer keys beat the legacy boundaryLineWidth", () => {
  const s = parseRingStyle(
    { $type: HOUSES_STYLE_TYPE, boundaryLineWidth: 2, innerBoundaryLineWidth: 0.75 },
    "houses",
  );
  if (s.$type === HOUSES_STYLE_TYPE) {
    expect(s.innerBoundaryLineWidth).toBe(0.75);
    expect(s.outerBoundaryLineWidth).toBe(2);
  } else {
    throw new Error("expected houses style");
  }
});

test("houses enums: known values parse, unknown fall back", () => {
  const s = parseRingStyle(
    { $type: HOUSES_STYLE_TYPE, numberFontWeight: "bold", extendCuspsToRing: "planetsRing" },
    "houses",
  );
  if (s.$type === HOUSES_STYLE_TYPE) {
    expect(s.numberFontWeight).toBe("bold");
    expect(s.extendCuspsToRing).toBe("planetsRing");
  }
  const bad = parseRingStyle(
    { $type: HOUSES_STYLE_TYPE, numberFontWeight: "ultra-bold", extendCuspsToRing: "mars" },
    "houses",
  );
  if (bad.$type === HOUSES_STYLE_TYPE) {
    expect(bad.numberFontWeight).toBe("regular");
    expect(bad.extendCuspsToRing).toBeUndefined();
  }
  // Default: rotateNumbers false (Swift decode default).
  expect(HOUSES_RING_STYLE_DEFAULT.rotateNumbers).toBe(false);
});

// ---------------------------------------------------------------------------
// AspectOverlayStyle (aspects ring style)
// ---------------------------------------------------------------------------

test("parses classic.json preset-level aspectOverlay shape under the aspects $type", () => {
  // PresetTemplates/classic.json /aspectOverlay (verified 2026-08-14) — the
  // preset-level field is the same AspectOverlayStyle struct the aspects ring
  // style wraps; no template carries an aspects RING, so this is the wire cite.
  const wire = {
    $type: "solar.kairos.preset.ring.style.aspects",
    aspectHues: {
      Biquintile: "sky",
      Conjunction: "red",
      MinorAspect: "greyscale",
      Opposition: "red",
      Quincunx: "purple",
      Quintile: "aqua",
      Semisextile: "yellow",
      Semisquare: "magenta",
      Sesquisquare: "indigo",
      Sextile: "green",
      Square: "orange",
      Trine: "blue",
    },
    bezierCurveStrength: 0.3,
    colorMode: "byType",
    dashPattern: [4, 4],
    lineWidth: 0.5,
    maximumAspectCount: 0,
    minimumStrength: 0,
    monochromeColor: { layer: "primitive", source: "semantic", value: "tertiary" },
    opacity: 0.4,
    renderMode: "straight",
    showMajorAspectsOnly: false,
    useDashedForSeparating: false,
  };
  const s = parseRingStyle(wire, "aspects");
  expect(s).toEqual({
    $type: ASPECTS_STYLE_TYPE,
    colorMode: "byType",
    monochromeColor: { source: "semantic", value: "tertiary", layer: "primitive" },
    lineWidth: 0.5,
    orbWeighting: 0,
    opacity: 0.4,
    useDashedForSeparating: false,
    dashPattern: [4, 4],
    renderMode: "straight",
    bezierCurveStrength: 0.3,
    showMajorAspectsOnly: false,
    minimumStrength: 0,
    maximumAspectCount: 0,
    aspectHues: {
      conjunction: "red",
      opposition: "red",
      trine: "blue",
      square: "orange",
      sextile: "green",
      quincunx: "purple",
      semiSextile: "yellow",
      semiSquare: "magenta",
      sesquiquadrate: "indigo",
      quintile: "aqua",
      biquintile: "sky",
      minorAspectHue: "greyscale",
    },
  });
});

test("empty aspects blob parses to the default (colorMode monochrome per Swift)", () => {
  const s = parseRingStyle({ $type: ASPECTS_STYLE_TYPE }, "aspects");
  expect(s).toEqual(ASPECT_OVERLAY_STYLE_DEFAULT);
  if (s.$type === ASPECTS_STYLE_TYPE) {
    expect(s.colorMode).toBe("monochrome");
    expect(s.aspectHues.conjunction).toBe("red");
    expect(s.aspectHues.minorAspectHue).toBe("greyscale");
  }
});

test("aspects style: malformed fields fall back; PascalCase hue keys round-trip", () => {
  const s = parseRingStyle(
    {
      $type: ASPECTS_STYLE_TYPE,
      colorMode: "rainbow",
      renderMode: "curly",
      dashPattern: [4, "x"],
      aspectHues: { Conjunction: "gold", Bogus: 1 },
      maximumAspectCount: 25,
    },
    "aspects",
  );
  if (s.$type === ASPECTS_STYLE_TYPE) {
    expect(s.colorMode).toBe("monochrome");
    expect(s.renderMode).toBe("straight");
    expect(s.dashPattern).toEqual([4, 4]);
    // Present hues object: per-field tolerance (known key kept, rest default).
    expect(s.aspectHues.conjunction).toBe("gold");
    expect(s.aspectHues.trine).toBe("blue");
    expect(s.maximumAspectCount).toBe(25);
  }
  const out = serializeRingStyle(s) as Record<string, unknown>;
  const hues = out.aspectHues as Record<string, unknown>;
  expect(hues.Conjunction).toBe("gold");
  expect(hues.Semisextile).toBe("yellow");
  expect(hues.MinorAspect).toBe("greyscale");
  expect("conjunction" in hues).toBe(false);
  expect(parseRingStyle(out, "aspects")).toEqual(s);
});

// ---------------------------------------------------------------------------
// Stage 3.5 styles
// ---------------------------------------------------------------------------

test("parses study.json decans style verbatim", () => {
  // PresetTemplates/study.json /soloChart/rings[decans]/style (verified 2026-08-14).
  const wire = {
    $type: "solar.kairos.preset.ring.style.decans",
    backgroundColor: { layer: "bg", source: "semantic", value: "disabled" },
    boundaryLineWidth: 0.5,
    glyphSize: 10,
    innerBoundaryWidth: 0.5,
    numberFontSize: 10,
    outerBoundaryWidth: 0.5,
    rotateGlyphs: false,
  };
  const s = parseRingStyle(wire, "decans");
  expect(s).toEqual({
    $type: DECANS_STYLE_TYPE,
    glyphSize: 10,
    rotateGlyphs: false,
    glyphColor: undefined,
    numberFontSize: 10,
    numberTextColor: undefined,
    boundaryLineWidth: 0.5,
    boundaryLineColor: undefined,
    outerBoundaryWidth: 0.5,
    innerBoundaryWidth: 0.5,
    backgroundColor: { source: "semantic", value: "disabled", layer: "bg" },
  });
  // Default glyphSize is 14 (Swift DecansStyle.default).
  expect(DECANS_STYLE_DEFAULT.glyphSize).toBe(14);
  expect(DECANS_STYLE_DEFAULT.backgroundColor).toEqual({
    source: "semantic",
    value: "disabled",
    layer: "bg",
  });
});

test("parses traditional.json signRulers style verbatim; default glyphSize 16", () => {
  // PresetTemplates/traditional.json /soloChart/rings[signRulers]/style (verified 2026-08-14).
  const wire = {
    $type: "solar.kairos.preset.ring.style.signRulers",
    backgroundColor: { layer: "bg", source: "semantic", value: "disabled" },
    boundaryLineWidth: 0.5,
    glyphSize: 12,
    innerBoundaryWidth: 0.5,
    outerBoundaryWidth: 0.5,
    rotateGlyphs: false,
  };
  const s = parseRingStyle(wire, "signRulers");
  expect(s).toEqual({
    $type: SIGN_RULERS_STYLE_TYPE,
    glyphSize: 12,
    rotateGlyphs: false,
    glyphColor: undefined,
    boundaryLineWidth: 0.5,
    boundaryLineColor: undefined,
    outerBoundaryWidth: 0.5,
    innerBoundaryWidth: 0.5,
    backgroundColor: { source: "semantic", value: "disabled", layer: "bg" },
  });
  expect(SIGN_RULERS_STYLE_DEFAULT.glyphSize).toBe(16);
});

test("terms style: defaults + explicit fields (no template carries a terms ring)", () => {
  // Swift decode-of-empty: optional colors decode via `decodeIfPresent`
  // WITHOUT `?? d.*` — an absent backgroundColor yields nil even though the
  // static default carries disabled-bg. The static default is only the
  // whole-blob failure fallback (defaultRingStyle / unknown $type).
  expect(parseRingStyle({ $type: TERMS_STYLE_TYPE }, "terms")).toEqual({
    ...TERMS_STYLE_DEFAULT,
    backgroundColor: undefined,
  });
  expect(defaultRingStyle("terms")).toEqual(TERMS_STYLE_DEFAULT);
  expect(TERMS_STYLE_DEFAULT.glyphSize).toBe(12);
  const s = parseRingStyle(
    { $type: TERMS_STYLE_TYPE, glyphSize: 9, rotateGlyphs: true, boundaryLineWidth: 1 },
    "terms",
  );
  expect(s).toEqual({
    $type: TERMS_STYLE_TYPE,
    glyphSize: 9,
    rotateGlyphs: true,
    glyphColor: undefined,
    boundaryLineWidth: 1,
    boundaryLineColor: undefined,
    outerBoundaryWidth: 0.5,
    innerBoundaryWidth: 0.5,
    backgroundColor: undefined, // absent on the wire → nil (Swift decodeIfPresent)
  });
});

test("parses study.json lunarMansions style verbatim", () => {
  // PresetTemplates/study.json /soloChart/rings[lunarMansions]/style (verified 2026-08-14).
  const wire = {
    $type: "solar.kairos.preset.ring.style.lunarMansions",
    backgroundColor: { layer: "bg", source: "semantic", value: "disabled" },
    boundaryLineWidth: 0.5,
    glyphSize: 10,
    innerBoundaryWidth: 0.5,
    outerBoundaryWidth: 0.5,
    rotateGlyphs: false,
    symbolFontSize: 8,
  };
  const s = parseRingStyle(wire, "lunarMansions");
  expect(s).toEqual({
    $type: LUNAR_MANSIONS_STYLE_TYPE,
    glyphSize: 10,
    rotateGlyphs: false,
    glyphColor: undefined,
    symbolFontSize: 8,
    symbolColor: undefined,
    boundaryLineWidth: 0.5,
    boundaryLineColor: undefined,
    outerBoundaryWidth: 0.5,
    innerBoundaryWidth: 0.5,
    backgroundColor: { source: "semantic", value: "disabled", layer: "bg" },
  });
  expect(LUNAR_MANSIONS_STYLE_DEFAULT.symbolFontSize).toBe(8);
});

test("parses starfield.json fixedStars style verbatim; boundary alias applies", () => {
  // PresetTemplates/starfield.json /soloChart/rings[fixedStars]/style (verified 2026-08-14).
  const wire = {
    $type: "solar.kairos.preset.ring.style.fixedStars",
    glyphColor: { layer: "ic", source: "semantic", value: "primary" },
    glyphSize: 14,
    innerBoundaryLineWidth: 0,
    outerBoundaryLineWidth: 0,
    rotateGlyphs: true,
    textOffset: 4,
    textSize: 8,
  };
  const s = parseRingStyle(wire, "fixedStars");
  expect(s).toEqual({
    $type: FIXED_STARS_STYLE_TYPE,
    glyphSize: 14,
    rotateGlyphs: true,
    glyphColor: { source: "semantic", value: "primary", layer: "ic" },
    textSize: 8,
    textOffset: 4,
    textColor: undefined,
    innerBoundaryLineWidth: 0,
    outerBoundaryLineWidth: 0,
    boundaryLineColor: undefined,
    backgroundColor: undefined,
  });
  // Default background is transparent (unique among Stage 3.5 styles).
  expect(FIXED_STARS_STYLE_DEFAULT.backgroundColor).toBeUndefined();
  // Legacy pre-split boundaryLineWidth seeds both edges (RingBoundaryLegacyAliasKeys).
  const legacy = parseRingStyle({ $type: FIXED_STARS_STYLE_TYPE, boundaryLineWidth: 3 }, "fixedStars");
  if (legacy.$type === FIXED_STARS_STYLE_TYPE) {
    expect(legacy.innerBoundaryLineWidth).toBe(3);
    expect(legacy.outerBoundaryLineWidth).toBe(3);
  }
});

test("parses minimal.json cuspAnnotations style verbatim; boundary alias applies", () => {
  // PresetTemplates/minimal.json /soloChart/rings[cuspAnnotations]/style (verified 2026-08-14).
  const wire = {
    $type: "solar.kairos.preset.ring.style.cuspAnnotations",
    backgroundColor: { layer: "bg", source: "semantic", value: "secondary" },
    innerBoundaryLineWidth: 1,
    outerBoundaryLineWidth: 1,
    degreesFontSize: 6,
    glyphSize: 15,
    glyphTextSpacing: 6,
    minutesFontSize: 6,
  };
  const s = parseRingStyle(wire, "cuspAnnotations");
  expect(s).toEqual({
    $type: CUSP_ANNOTATIONS_STYLE_TYPE,
    glyphSize: 15,
    glyphColor: undefined,
    degreesFontSize: 6,
    minutesFontSize: 6,
    textColor: undefined,
    glyphTextSpacing: 6,
    backgroundColor: { source: "semantic", value: "secondary", layer: "bg" },
    boundaryLineColor: undefined,
    innerBoundaryLineWidth: 1,
    outerBoundaryLineWidth: 1,
  });
  expect(CUSP_ANNOTATIONS_STYLE_DEFAULT.backgroundColor).toEqual({
    source: "semantic",
    value: "secondary",
    layer: "bg",
  });
  const legacy = parseRingStyle(
    { $type: CUSP_ANNOTATIONS_STYLE_TYPE, boundaryLineWidth: 2 },
    "cuspAnnotations",
  );
  if (legacy.$type === CUSP_ANNOTATIONS_STYLE_TYPE) {
    expect(legacy.innerBoundaryLineWidth).toBe(2);
    expect(legacy.outerBoundaryLineWidth).toBe(2);
  }
});

test("all ten styles parse (only five render, but all ten parse)", () => {
  const types = [
    ZODIAC_STYLE_TYPE,
    PLANETS_STYLE_TYPE,
    HOUSES_STYLE_TYPE,
    ASPECTS_STYLE_TYPE,
    DECANS_STYLE_TYPE,
    SIGN_RULERS_STYLE_TYPE,
    TERMS_STYLE_TYPE,
    LUNAR_MANSIONS_STYLE_TYPE,
    FIXED_STARS_STYLE_TYPE,
    CUSP_ANNOTATIONS_STYLE_TYPE,
  ];
  for (const $type of types) {
    expect(parseRingStyle({ $type }, "zodiac").$type).toBe($type);
  }
});

test("known $type decodes by its own shape regardless of ringType hint", () => {
  // Swift RingStyle decodes on $type alone; style/ring-type mismatches are a
  // validation-tier concern, not a parse-tier one.
  const s = parseRingStyle({ $type: DECANS_STYLE_TYPE, glyphSize: 11 }, "planets");
  expect(s.$type).toBe(DECANS_STYLE_TYPE);
  if (s.$type === DECANS_STYLE_TYPE) expect(s.glyphSize).toBe(11);
});

// ---------------------------------------------------------------------------
// RingContent
// ---------------------------------------------------------------------------

test("legacy inline contents parse classic.json blobs verbatim", () => {
  // PresetTemplates/classic.json /soloChart/rings[0..2]/content (verified 2026-08-14).
  expect(
    parseRingContent(
      {
        $type: "solar.kairos.preset.ring.content.zodiac",
        showBoundaries: true,
        showDegrees: true,
        showSymbols: true,
      },
      "zodiac",
    ),
  ).toEqual({ $type: ZODIAC_CONTENT_TYPE, showSymbols: true, showDegrees: true, showBoundaries: true });

  expect(
    parseRingContent(
      { $type: "solar.kairos.preset.ring.content.planets", showRetrograde: true, showSpeeds: false },
      "planets",
    ),
  ).toEqual({ $type: PLANETS_CONTENT_TYPE, showRetrograde: true, showSpeeds: false });

  expect(
    parseRingContent(
      {
        $type: "solar.kairos.preset.ring.content.houses",
        showCusps: true,
        showNumbers: true,
        system: "Placidus",
      },
      "houses",
    ),
  ).toEqual({
    $type: HOUSES_CONTENT_TYPE,
    system: "Placidus",
    showCusps: true,
    showNumbers: true,
  });
});

test("content defaults match defaultStyleAndContent (Swift)", () => {
  expect(parseRingContent({ $type: ZODIAC_CONTENT_TYPE }, "zodiac")).toEqual(
    ZODIAC_RING_CONTENT_DEFAULT,
  );
  expect(ZODIAC_RING_CONTENT_DEFAULT).toEqual({
    $type: ZODIAC_CONTENT_TYPE,
    showSymbols: true,
    showDegrees: true,
    showBoundaries: true,
  });
  expect(PLANETS_RING_CONTENT_DEFAULT).toEqual({
    $type: PLANETS_CONTENT_TYPE,
    showRetrograde: true,
    showSpeeds: false,
  });
  expect(HOUSES_RING_CONTENT_DEFAULT).toEqual({
    $type: HOUSES_CONTENT_TYPE,
    system: "Placidus",
    showCusps: true,
    showNumbers: true,
  });
});

test("legacy planets content `bodies` key is ignored (decode-and-discard)", () => {
  const c = parseRingContent(
    {
      $type: "solar.kairos.preset.ring.content.planets",
      bodies: ["Sun", "Moon"],
      showRetrograde: false,
      showSpeeds: true,
    },
    "planets",
  );
  expect(c).toEqual({ $type: PLANETS_CONTENT_TYPE, showRetrograde: false, showSpeeds: true });
  expect("bodies" in c).toBe(false);
});

test("houses content: unknown house system coerces to Placidus", () => {
  const c = parseRingContent(
    { $type: "solar.kairos.preset.ring.content.houses", system: "Fakedus" },
    "houses",
  );
  expect(c).toEqual(HOUSES_RING_CONTENT_DEFAULT);
  const ws = parseRingContent(
    { $type: "solar.kairos.preset.ring.content.houses", system: "Whole Sign" },
    "houses",
  );
  if (ws.$type === HOUSES_CONTENT_TYPE) expect(ws.system).toBe("Whole Sign");
});

test("aspects content: defaults carry all 11 types, Swift default orbs (Square 7)", () => {
  expect(ASPECTS_RING_CONTENT_DEFAULT).toEqual({
    $type: ASPECTS_CONTENT_TYPE,
    enabledTypes: [
      "Conjunction",
      "Opposition",
      "Trine",
      "Square",
      "Sextile",
      "Quincunx",
      "Semisextile",
      "Semisquare",
      "Sesquisquare",
      "Quintile",
      "Biquintile",
    ],
    orbs: ASPECT_ORBS_DEFAULT,
    showGrid: true,
  });
  expect(ASPECT_ORBS_DEFAULT.orbs.Square).toBe(7);
  expect(ASPECT_ORBS_DEFAULT.orbs.Conjunction).toBe(8);
  expect(ASPECT_ORBS_DEFAULT.orbs.Sextile).toBe(6);
});

test("aspects content: partial orb maps pass through un-merged; unknown types pass through", () => {
  const c = parseRingContent(
    {
      $type: "solar.kairos.preset.ring.content.aspects",
      enabledTypes: ["Conjunction", "FutureAspect"],
      orbs: { orbs: { Conjunction: 6, Bogus: "x" } },
      showGrid: false,
    },
    "aspects",
  );
  expect(c).toEqual({
    $type: ASPECTS_CONTENT_TYPE,
    enabledTypes: ["Conjunction", "FutureAspect"],
    orbs: { orbs: { Conjunction: 6 } },
    showGrid: false,
  });
});

test("Stage 3.5 contents parse template blobs verbatim", () => {
  // study.json decans + lunarMansions; traditional.json signRulers;
  // starfield.json fixedStars; minimal.json cuspAnnotations (verified 2026-08-14).
  expect(
    parseRingContent(
      { $type: "solar.kairos.preset.ring.content.decans", system: "chaldean" },
      "decans",
    ),
  ).toEqual({ $type: DECANS_CONTENT_TYPE, system: "chaldean" });

  expect(
    parseRingContent(
      { $type: "solar.kairos.preset.ring.content.signRulers", system: "traditional" },
      "signRulers",
    ),
  ).toEqual({ $type: SIGN_RULERS_CONTENT_TYPE, system: "traditional" });

  expect(
    parseRingContent(
      {
        $type: "solar.kairos.preset.ring.content.lunarMansions",
        displayMode: "rulers",
        system: "nakshatras",
      },
      "lunarMansions",
    ),
  ).toEqual({ $type: LUNAR_MANSIONS_CONTENT_TYPE, system: "nakshatras", displayMode: "rulers" });

  expect(
    parseRingContent(
      {
        $type: "solar.kairos.preset.ring.content.cuspAnnotations",
        showDegrees: true,
        showMinutes: true,
        showSignGlyph: true,
      },
      "cuspAnnotations",
    ),
  ).toEqual({
    $type: CUSP_ANNOTATIONS_CONTENT_TYPE,
    showSignGlyph: true,
    showDegrees: true,
    showMinutes: true,
  });
});

test("fixedStars content is a unit variant on the wire ($type only)", () => {
  // PresetTemplates/starfield.json /soloChart/rings[fixedStars]/content — the
  // wire body is empty; showDegrees/showSign/showMinutes are iOS-side
  // build-time transients, NOT wire fields.
  const c = parseRingContent(
    { $type: "solar.kairos.preset.ring.content.fixedStars" },
    "fixedStars",
  );
  expect(c).toEqual({ $type: FIXED_STARS_CONTENT_TYPE });
  expect(serializeRingContent(c)).toEqual({ $type: FIXED_STARS_CONTENT_TYPE });
});

test("unknown enum values on Stage 3.5 contents coerce to defaults", () => {
  expect(
    parseRingContent({ $type: DECANS_CONTENT_TYPE, system: "freudian" }, "decans"),
  ).toEqual({ $type: DECANS_CONTENT_TYPE, system: "chaldean" });
  expect(parseRingContent({ $type: TERMS_CONTENT_TYPE }, "terms")).toEqual(
    TERMS_RING_CONTENT_DEFAULT,
  );
  expect(TERMS_RING_CONTENT_DEFAULT).toEqual({ $type: TERMS_CONTENT_TYPE, system: "egyptian" });
});

test("unknown content $type degrades to the ring type's default content", () => {
  expect(
    parseRingContent({ $type: "solar.kairos.preset.ring.content.nonsense" }, "planets"),
  ).toEqual(PLANETS_RING_CONTENT_DEFAULT);
  expect(parseRingContent(undefined, "zodiac")).toEqual(ZODIAC_RING_CONTENT_DEFAULT);
});

test("content serialize round-trips through parse (fixed point)", () => {
  const c = parseRingContent(
    {
      $type: "solar.kairos.preset.ring.content.lunarMansions",
      system: "manzils",
      displayMode: "symbols",
    },
    "lunarMansions",
  );
  const out = serializeRingContent(c) as Record<string, unknown>;
  expect(out.$type).toBe("solar.kairos.preset.ring.content.lunarMansions");
  expect(parseRingContent(out, "lunarMansions")).toEqual(c);
});

// ---------------------------------------------------------------------------
// RingModule
// ---------------------------------------------------------------------------

test("parses classic.json solo zodiac ring module verbatim", () => {
  // PresetTemplates/classic.json /soloChart/rings[0] (verified 2026-08-14):
  // wire key is `ringType`; thickness is the tagged {kind,value} shape.
  const wire = {
    content: {
      $type: "solar.kairos.preset.ring.content.zodiac",
      showBoundaries: true,
      showDegrees: true,
      showSymbols: true,
    },
    enabled: true,
    id: "zodiac",
    ringType: "zodiac",
    style: {
      $type: "solar.kairos.preset.ring.style.zodiac",
      glyphSize: 15,
      majorMarkInterval: 10,
      majorMarkLength: 8,
      majorMarkWidth: 0.5,
      minorMarkInterval: 1,
      minorMarkLength: 4,
      minorMarkWidth: 0.5,
      radialLineWidth: 0.5,
      rotateGlyphs: true,
      segmentBorderWidth: 1,
      showDegreeMarkers: false,
    },
    thickness: { kind: "fixed", value: 20 },
  };
  const m = parseRingModule(wire);
  expect(m.id).toBe("zodiac");
  expect(m.type).toBe("zodiac");
  expect(m.enabled).toBe(true);
  expect(m.thickness).toEqual({ kind: "fixed", value: 20 });
  expect(m.style).toEqual(parseRingStyle(wire.style, "zodiac"));
  expect(m.content).toEqual(ZODIAC_RING_CONTENT_DEFAULT);

  // Serialize maps `type` back to the `ringType` wire key; fixed point holds.
  const out = serializeRingModule(m) as Record<string, unknown>;
  expect(out.ringType).toBe("zodiac");
  expect("type" in out).toBe(false);
  expect(parseRingModule(out)).toEqual(m);
});

test("ring module: malformed fields degrade; unknown ringType → zodiac", () => {
  const m = parseRingModule({ id: 42, ringType: "gloom", enabled: "yes" });
  expect(m.id).toBe("");
  expect(m.type).toBe("zodiac");
  expect(m.enabled).toBe(true);
  expect(m.thickness).toEqual({ kind: "auto" });
  expect(m.style).toEqual(ZODIAC_RING_STYLE_DEFAULT);
  expect(m.content).toEqual(ZODIAC_RING_CONTENT_DEFAULT);
});

test("defaultRingStyle covers every ring type", () => {
  expect(defaultRingStyle("planets")).toEqual(PLANETS_RING_STYLE_DEFAULT);
  expect(defaultRingStyle("zodiac")).toEqual(ZODIAC_RING_STYLE_DEFAULT);
  expect(defaultRingStyle("nonsense")).toEqual(ZODIAC_RING_STYLE_DEFAULT);
});

test("parseRingThickness still honored through module parse", () => {
  const m = parseRingModule({
    id: "x",
    ringType: "houses",
    thickness: { kind: "fixed" },
    style: { $type: HOUSES_STYLE_TYPE },
    content: { $type: HOUSES_CONTENT_TYPE },
  });
  expect(m.thickness).toEqual(parseRingThickness({ kind: "fixed" }));
});
