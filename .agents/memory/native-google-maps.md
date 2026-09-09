---
name: Native Google Maps provider
description: Native map provider and build-key constraints for the OG Landmark mobile app.
---

Native iOS and Android map surfaces should use the same react-native-maps Google provider. Platform-specific wrapper files must re-export the shared native implementation rather than maintaining a second WebView map, because the web preview cannot exercise native provider behavior.

**Why:** The old Android-only map path silently diverged from native marker, clustering, camera, and exact-coordinate behavior. A missing native SDK key can also crash map initialization instead of producing a useful UI state.

**How to apply:** Keep `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` out of source and inject it through Expo config for both platform SDKs. Native map components should resolve the embedded `Constants.expoConfig` platform key as a runtime fallback because native bundles may not expose the public env variable. Preserve the graceful missing-key/loading/retry states, and run real iOS and Android build smoke tests whenever the restricted key is available.