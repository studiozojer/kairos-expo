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

The browser currently shows “Login coming soon.” Chart JSON arrays or Expo saved-session JSON files can be opened locally; imported libraries stay in browser memory. Calculations send only the requested date, coordinates, and calculation settings to the chart service. Account access is reserved for a later release.

`npm run web:build` builds the web assets alone. After building, `python3 scripts/serve-web.py --skip-build` serves them without rebuilding. Stop the process with Ctrl-C.

For the hosted edition, Caddy serves `dist/` and forwards only `/local/calculate` to the Gunicorn WSGI app in `scripts/web_api.py`. Deployment templates are `scripts/kairos-web.Caddyfile` and `scripts/kairos-web.service`. Set `KAIROS_WEB_LIBRARY` to the Linux FFI library and `KAIROS_WEB_ASSETS` to the atlas/ephemeris directory. The public API exposes no login or account operations.
