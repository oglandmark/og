---
name: Expo Go native-module compatibility
description: Records native-module guards required for this app to open in Expo Go.
---

Use `expo-video` and `expo-audio`; do not reintroduce `expo-av`.

**Why:** Expo Go 57 does not provide the `ExponentAV` native module, so importing `expo-av` crashes Android startup before Expo Router can load.

Android Expo Go also excludes remote push notification functionality. Never runtime-import or invoke `expo-notifications` there; load it lazily only in development/production builds and make Expo Go registration/listeners no-ops.

**How to apply:** Keep media playback on the SDK-compatible Expo video/audio packages, preserve the Expo Go push guard, and run Expo dependency checks after SDK or native-package changes.

The local static Expo build can print a missing `libglib-2.0.so.0` React Native DevTools warning while still completing both iOS and Android bundles successfully.

**Why:** The DevTools helper is optional for bundling; treating that warning as a build failure would hide a valid artifact.

**How to apply:** Judge this environment's mobile build by Metro/bundle completion and manifest generation, while still investigating any actual bundle or runtime errors.