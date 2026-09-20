# Kairos native module

Calculates a chart at a supplied UTC instant using the bundled Swiss Ephemeris. Initialization is lazy, once per process, and serialized with calculations and atlas searches. No motion-tree initialization or server access occurs. The chart route captures one instant per mount; retries preserve it and display edits do not recalculate.

The default location is Seattle's city reference point (47.6062, -122.3321), elevation 0 m as an explicit sea-level reference, timezone America/Los_Angeles for presentation. The chart settings sheet persists the selected atlas location and house system on the device; Seattle and Placidus remain the initial defaults. Changes recalculate the captured instant. Calculations use tropical zodiac, mean lunar nodes, and mean Lilith. Location-derived angles and lots come from Rust. The first slice supports dates from 1900 inclusive to 2100 exclusive; that is an intentional application bound inside the bundled contemporary data. No GPS permission is requested.

Native results use `KairosResult` and are copied before `kairos_result_free` on both success and failure. Swift calls the C ABI directly; Kotlin calls a small C++ JNI adapter. Top-level ios/android directories remain CNG artifacts. `plugins/with-kairos.js` preserves the iOS 17 deployment floor and supported Android architectures through prebuild.

Use a native app build (`npm run ios` or `npm run android`), then open the Chart tab. Expo Go and the web build cannot load these bundled native libraries. No engine checkout is needed to run the committed artifacts.

## Rebuilding

Use the matching kairos-engine revision recorded in `ios-provenance.json` and `android-provenance.json`. The initial implementation is on `feat/expo-live-sky`. Source checkouts need the sibling jianyi repository; runtime builds use only the committed module artifacts and assets.

```sh
KAIROS_ENGINE_PATH=/path/to/kairos-engine scripts/build-kairos-ios.sh
PATH=/path/to/cargo-ndk/bin:$PATH KAIROS_ENGINE_PATH=/path/to/kairos-engine ANDROID_NDK_HOME=/path/to/android-ndk scripts/build-kairos-android.sh
```

Install the relevant Rust targets first: aarch64-apple-ios, aarch64-apple-ios-sim, aarch64-linux-android, x86_64-linux-android. Android uses cargo-ndk and NDK r28 or newer; this integration was developed against r30. The Android native libraries cover arm64 devices/emulators and x86_64 emulators, with 16 KiB page alignment. The iOS libraries cover arm64 devices and Apple Silicon simulators. The build records the engine revision, tracked source diff, compiler version, features, and binary hashes. Release artifacts should record a clean committed source revision.

The module's `include/kairos_bridge.h` mirrors the stable C ABI in kairos-ffi. Changes to that ABI must update both native adapters and their header together. The pod is named KairosBridge so its library cannot shadow libkairos.a on a case-insensitive filesystem.

## Data and verification

`assets/Atlas/atlas.db` is the offline atlas copied from kairos-ios, with source revision and SHA-256 in `provenance.json`. Search uses the existing `kairos_search_locations` C ABI on the same serialized engine queue. iOS opens its bundled database read-only; Android extracts it to app-private storage and opens it read-only. Updating this data requires a native rebuild. `tests/atlas-smoke.c` exercises the real database (use a city outside the static fallback, such as Benatky).

`assets/Ephemeris` is copied from kairos-ios's Ephemeris resources; `manifest.json` records SHA-256 for each file. Both native adapters verify those bundled files before initialization. Android extracts them to app-private storage because the C library needs filesystem paths. The manifest is immutable build input, not a downloaded catalog.

`seattle-2026.json` in the chart fixtures is host Rust output from this implementation at 2026-09-13T19:00:00Z, with the same body set and settings as the live service. It is used only in tests, never as a runtime fallback. Runtime response validation checks timestamp, location, transit type, required bodies, houses, finite positions, and aspect endpoints.

The Rust test is intentionally explicit about real data:

```sh
SWEPH_PATH=/path/to/modules/kairos/assets/Ephemeris SQLX_OFFLINE=true cargo test --release -p kairos-ffi --test live_chart --no-default-features --features database-sqlite,tokio-minimal -- --ignored
```

An inherited limitation outside the Seattle slice: the low-level house wrapper currently discards Swiss house-calculation status. Replacing the old FFI `expect` does not by itself make polar-latitude house failures observable. The settings picker exposes the existing engine systems without repairing that inherited limitation.

### Asteroid coverage

The stepped sky requests Chiron, Ceres, Pallas, Juno, Vesta, Eros and Pholus independently of display visibility. Display uses the same list; all seven have bundled glyphs. `seas_18.se1` supplies the main asteroids and centaurs; Eros additionally needs `se00433s.se1`, copied from kairos-ios commit `8f7f82dd4ba0f5a12fa748eefd1419849d9138aa` and checksum-pinned in `assets/Ephemeris/manifest.json`. Both native adapters consume that manifest. Existing installed builds need rebuilding to pick up the added Eros asset; a JavaScript-only update is insufficient.

Run `python3 modules/kairos/tests/asteroids-smoke.py /path/to/libkairos.dylib` with a host build supporting transit charts. The repaired fixture was generated with the existing host build from engine revision `764bc05e71ce8f70cc217240f9f379936cacfa30`, matching the packaged native provenance. It checks all requested bodies at 23 dates spanning the application bounds and verifies that all seven asteroids move over a day step. `--write-fixture` regenerates the Seattle fixture with the expanded body set. This is host C ABI evidence, not a simulator/device rendering check. The larger celestial catalog and its missing glyphs remain outside this repair.
