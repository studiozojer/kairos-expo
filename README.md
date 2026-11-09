# kairos-expo

Kairos, rebuilt in Expo. The journal is the product; the sky is its index.

Two tabs and a search: the journal (home — the daily glance), the chart (the interactive experience), and global search as the separated bar accessory. iOS + Android, with a local desktop chart viewer for macOS.

Design seed, decisions, and the staged build walk: `zojercommons/projects/kairos/specs/2026-08-05-kairos-expo-pivot-design.md` (in the studio commons). Working conventions: `AGENTS.md`.

```bash
npm install
npm run sync-tokens && npm run sync-type && npm run sync-fonts   # needs ../daoUI (or DAOUI_PATH)
npm start
```

For charts on this Mac, run `npm run web` and open **http://127.0.0.1:8765**. This builds the desktop browser entry and starts a server bound to loopback. Native entry still opens Expo Router. The desktop uses the same Skia wheel, presets, glyphs, geometry, and calculation request validation as the phone app, with a searchable library beside the wheel.

The local server calls `../kairos-engine/target/debug/libkairos.dylib` and reads the primary checkout's bundled atlas and ephemeris. Build a current library with `cargo build -p kairos-ffi --no-default-features --features database-sqlite,tokio-minimal --locked` in kairos-engine; an old library may return incompatible chart data. Restart the local server after rebuilding the library. `KAIROS_ENGINE_PATH` or `KAIROS_WEB_LIBRARY` can override its location. No Xcode or simulator is needed. Browser-only hosting without this local bridge is not supported by this version.

The browser currently shows “Login coming soon.” The browser shows the live sky; the chart-file import control is hidden. Calculations send only the requested date, coordinates, and calculation settings to the chart service. Account access is reserved for a later release.

`npm run web:build` builds the web assets alone. After building, `python3 scripts/serve-web.py --skip-build` serves them without rebuilding. Stop the process with Ctrl-C.

For the hosted edition, Caddy serves `dist/` and forwards only `/local/calculate` to the Gunicorn WSGI app in `scripts/web_api.py`. Deployment templates are `scripts/kairos-web.Caddyfile` and `scripts/kairos-web.service`. Set `KAIROS_WEB_LIBRARY` to the Linux FFI library and `KAIROS_WEB_ASSETS` to the atlas/ephemeris directory. The public API exposes no login or account operations.

The web viewer defaults to axis lines with zodiac-band angle glyphs. Annotation visibility follows the selected wheel preset; the evaluation-only Angles and Annotations selectors have been removed. Angle overlays inherit the planet ring’s degree/minute visibility, font size, color, and spacing; they show no sign names, background boxes, or leader lines. Zodiac annotations extend inward beneath the sign band. Lines use the engine’s actual ASC/DSC/MC/IC, independently of the house system. `angleOverlay: { enabled: true, labels: "inner" | "zodiac" | "outside" }` remains an optional Expo preset extension; absent fields preserve existing appearance outside the web viewer. Older Swift/Rust preset writers may drop it. Native settings integration is still pending.

The QA script captures the shipped zodiac default and checks that the evaluation selectors are absent. Earlier multi-mode captures require their corresponding historical commits. Angle evaluation screenshots are under `.github/angle-evaluation/`. To reproduce with Playwright installed, run `KAIROS_EVIDENCE=/tmp/kairos-angles node scripts/qa-angle-overlay.cjs` against the local web server. `PLAYWRIGHT_MODULE` and `CHROMIUM_EXECUTABLE` can point to an external QA installation. `KAIROS_STRESS=1` captures deliberately synthetic near-coincident angles; those screenshots are layout stress evidence, not an astronomical chart. Captures freeze time at 2026-11-08T20:00:00Z and use the real calculation service for the normal scenario.

Angle glyphs stay at their exact longitudes. With overlap prevention enabled, planet glyphs and their radial annotation stacks search for free space around those fixed footprints within their house/sign windows; astronomical ticks stay fixed. Infeasible cases are listed in `WheelLayout.unresolvedAngleCollisions`. Near-coincident angle glyphs may overlap each other because neither is displaced.

### Browser glyph rendering

Web chart glyphs use generated Skia paths (`Glyph.web.tsx`) so strokes, fills, and rotated symbols render at the canvas device resolution. Native `Glyph.tsx` retains its SVG rendering. `npm run sync-glyphs` also generates `glyph-vectors.gen.ts`; to regenerate just the vectors from the committed SVG catalog, run `python3 scripts/generate-glyph-vectors.py`. The generator records the upstream source revision and a catalog hash and rejects unsupported SVG features. Run `python3 scripts/test-glyph-vectors.py` to check conversion semantics. The generated file is never edited by hand.
