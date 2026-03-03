#!/usr/bin/env bash
#
# Source this script to set JAVA_HOME and ANDROID_HOME for the current shell.
#
#   source scripts/env-android.sh
#

JAVA_HOME_PATH="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
if [[ ! -d "$JAVA_HOME_PATH" ]]; then
  echo "Error: JAVA_HOME not found at $JAVA_HOME_PATH"
  echo "       Install Android Studio or set JAVA_HOME manually."
  return 1 2>/dev/null || exit 1
fi

ANDROID_SDK_PATH="$HOME/Library/Android/sdk"
if [[ ! -d "$ANDROID_SDK_PATH" ]]; then
  echo "Error: Android SDK not found at $ANDROID_SDK_PATH"
  echo "       Install the Android SDK via Android Studio or set ANDROID_HOME manually."
  return 1 2>/dev/null || exit 1
fi

export JAVA_HOME="$JAVA_HOME_PATH"
export ANDROID_HOME="$ANDROID_SDK_PATH"
export ANDROID_SDK_ROOT="$ANDROID_SDK_PATH"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/emulator:$PATH"

echo "JAVA_HOME    = $JAVA_HOME"
echo "ANDROID_HOME = $ANDROID_HOME"
echo ""
echo "Android env ready. You can now run:"
echo "  npx expo run:android"
