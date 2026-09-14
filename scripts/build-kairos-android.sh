#!/bin/bash
set -euo pipefail
APP_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
: "${KAIROS_ENGINE_PATH:?Set KAIROS_ENGINE_PATH to the engine checkout}"
: "${ANDROID_NDK_HOME:?Set ANDROID_NDK_HOME to Android NDK r28 or newer}"
ENGINE_ROOT="$(cd "$KAIROS_ENGINE_PATH" && pwd)"
export CARGO_TARGET_DIR="$ENGINE_ROOT/target/expo-live-sky"
export SQLX_OFFLINE=true
# Native libraries must support Android devices with 16 KiB pages.
export RUSTFLAGS="${RUSTFLAGS:-} -C link-arg=-Wl,-z,max-page-size=16384"
DEST="$APP_ROOT/modules/kairos/android/src/main/jniLibs"
cd "$ENGINE_ROOT"
cargo ndk -t arm64-v8a -t x86_64 -o "$DEST" \
  build --locked --release -p kairos-ffi --no-default-features --features database-sqlite,tokio-minimal
rm -f "$DEST/arm64-v8a/libjianyi.so" "$DEST/x86_64/libjianyi.so"
python3 "$APP_ROOT/scripts/kairos-provenance.py" "$ENGINE_ROOT" "$DEST" android
