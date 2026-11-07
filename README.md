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

Sign in with your ATProto handle, complete sign-in in the new tab, then paste the one-time code into the viewer within 60 seconds. Session tokens stay in the local Python process; the browser receives an HttpOnly, SameSite cookie. Restarting the server requires signing in again. Account downloads are read-only: chart records and compatible preserved Swift charts can be viewed without enabling upload sync or converting the archive. Charts needing compatibility review remain in the phone app. A chart JSON array or Expo saved-session JSON can also be opened locally; imported data stays in browser memory.

`npm run web:build` builds the web assets alone. After building, `python3 scripts/serve-web.py --skip-build` serves them without rebuilding. Stop the process with Ctrl-C.
