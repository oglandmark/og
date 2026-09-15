---
name: Native Google Maps provider
description: Native map provider and build-key constraints for the OG Landmark mobile app.
---

Native iOS and Android map surfaces should use the same react-native-maps Google provider. Platform-specific wrapper files must re-export the shared native implementation rather than maintaining a second WebView map, because the web preview cannot exercise native provider behavior.

**Why:** The old Android-only map path silently diverged from native marker, clustering, camera, and exact-coordinate behavior. A missing native SDK key can also crash map initialization instead of producing a useful UI state.

**How to apply:** Keep `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY` out of source and inject it through Expo config for both platform SDKs. Native map components should resolve the embedded `Constants.expoConfig` platform key as a runtime fallback because native bundles may not expose the public env variable. Preserve graceful missing-key/loading states, wait for `onMapLoaded` rather than only `onMapReady`, and switch to the OSM/Esri fallback when native tiles never load.

Expo Go can still show the Google watermark with blank tiles when the app key is restricted to the production package, because Expo Go uses its own native package/signing identity. Use a real OSM/Esri tile fallback only in Expo Go preview; keep EAS/production builds on the Google provider.

**Why:** This preserves the native Google Maps architecture for shipped Android/iOS apps while keeping Replit's Expo Go preview useful for location and listing flows.

**How to apply:** Detect Expo Go at runtime and route preview-only map surfaces through the fallback. Do not add a WebView/Leaflet implementation to the Android platform wrapper or replace the production Google provider.

For the Expo Go fallback, keep the WebView document stable and push marker, center, and radius updates through `injectJavaScript`; rebuilding the HTML source on every parent render makes returning from a property detail feel like a fresh map load.

**Why:** Explore data and filter state can rerender while the user navigates, and a remote Leaflet document otherwise re-downloads its scripts and tiles unnecessarily.

**How to apply:** Initialize the map HTML once per mounted fallback, cache the WebView, keep the native WebView touch stream enabled while locking HTML overflow, use the explicit pinch bridge/zoom controls, and update the radius circle center from map movement events.