#!/bin/bash
set -euo pipefail
APP_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
: "${KAIROS_ENGINE_PATH:?Set KAIROS_ENGINE_PATH to the engine checkout}"
ENGINE_ROOT="$(cd "$KAIROS_ENGINE_PATH" && pwd)"
BUILD_ROOT="$ENGINE_ROOT/target/expo-live-sky"
export CARGO_TARGET_DIR="$BUILD_ROOT"
export SQLX_OFFLINE=true
export IPHONEOS_DEPLOYMENT_TARGET=17.0
export CARGO_PROFILE_RELEASE_STRIP=none
for target in aarch64-apple-ios aarch64-apple-ios-sim; do
  cargo build --manifest-path "$ENGINE_ROOT/Cargo.toml" --locked --release \
    --target "$target" -p kairos-ffi --no-default-features --features database-sqlite,tokio-minimal
 done
STAGING="$(mktemp -d)"
trap 'rm -rf "$STAGING"' EXIT
xcodebuild -create-xcframework \
  -library "$BUILD_ROOT/aarch64-apple-ios/release/libkairos.a" \
  -library "$BUILD_ROOT/aarch64-apple-ios-sim/release/libkairos.a" \
  -output "$STAGING/KairosEngine.xcframework"
DEST="${KAIROS_IOS_OUTPUT_PATH:-$APP_ROOT/modules/kairos/ios/KairosEngine.xcframework}"
mkdir -p "$(dirname "$DEST")"
rm -rf "$DEST"
cp -R "$STAGING/KairosEngine.xcframework" "$DEST"
python3 "$APP_ROOT/scripts/kairos-provenance.py" "$ENGINE_ROOT" "$DEST" ios
