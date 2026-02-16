#!/usr/bin/env bash
#
# Build the Android project with the correct JAVA_HOME and ANDROID_HOME.
#
# Usage:
#   scripts/build-android.sh                    # npx expo run:android
#   scripts/build-android.sh --no-install       # build only, don't install on device
#   scripts/build-android.sh --gradle-only      # run ./gradlew assembleDebug directly
#   scripts/build-android.sh --gradle-only --release  # release variant via Gradle
#
# Environment:
#   JAVA_HOME    – Android Studio bundled JBR (auto-detected)
#   ANDROID_HOME – Android SDK (auto-detected at ~/Library/Android/sdk)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# ── Java (Android Studio bundled JBR) ────────────────────────────────────────
JAVA_HOME_PATH="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
if [[ ! -d "$JAVA_HOME_PATH" ]]; then
  echo "Error: JAVA_HOME not found at $JAVA_HOME_PATH"
  echo "       Install Android Studio or set JAVA_HOME manually."
  exit 1
fi
export JAVA_HOME="$JAVA_HOME_PATH"
export PATH="$JAVA_HOME/bin:$PATH"

# ── Android SDK ──────────────────────────────────────────────────────────────
ANDROID_SDK_PATH="$HOME/Library/Android/sdk"
if [[ ! -d "$ANDROID_SDK_PATH" ]]; then
  echo "Error: Android SDK not found at $ANDROID_SDK_PATH"
  echo "       Install the Android SDK via Android Studio or set ANDROID_HOME manually."
  exit 1
fi
export ANDROID_HOME="$ANDROID_SDK_PATH"
export ANDROID_SDK_ROOT="$ANDROID_SDK_PATH"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"

echo "JAVA_HOME  = $JAVA_HOME"
echo "ANDROID_HOME = $ANDROID_HOME"
echo ""

# ── Build ────────────────────────────────────────────────────────────────────
cd "$REPO_ROOT"

if [[ "${1:-}" == "--gradle-only" ]]; then
  shift
  echo "==> Running ./gradlew assembleDebug $*"
  cd android
  ./gradlew assembleDebug "$@"
else
  echo "==> Running npx expo run:android $*"
  npx expo run:android "$@"
fi
