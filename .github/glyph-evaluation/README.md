# Browser vector glyphs

Before/after captures use the same frozen Seattle chart, Classic preset, dark appearance, and device pixel ratio 2. Run `KAIROS_DPR=2 KAIROS_DARK=1 KAIROS_EVIDENCE=/tmp/kairos-vectors node scripts/qa-angle-overlay.cjs` with the local server running. `PLAYWRIGHT_MODULE` and `CHROMIUM_EXECUTABLE` can select an external browser installation.

The old web ImageSVG path rasterized each SVG at its intrinsic size (normally 20×20), then scaled/rotated the bitmap. The new web-only Glyph draws generated Skia paths, preserving strokes, opacity, line caps/joins, transformed lines, rounded rectangles, and the catalog's viewport clip. AngleGlyph now uses that same renderer. Native SVG rendering and the source artwork are unchanged.

Observed at DPR 2: planet and zodiac outlines are smooth instead of visibly pixelated. Existing layout overlaps are unchanged; this is a rendering-resolution change.

Validation includes all 73 glyphs parsing successfully through Skia, converter tests for shape/paint/clip behavior and rejection of unsupported artwork, typecheck, full Jest suite, and a web export. Native rendering code was not changed or visually retested.
