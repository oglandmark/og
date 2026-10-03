---
name: Mobile Mapbox provider
description: Provider choice and build-environment requirements for OG Landmark native maps.
---

Native map screens in OG Landmark use the shared Mapbox WebView renderer. Do not route these screens through Google Maps unless the user explicitly asks. The Mapbox token is a public client token and must be available as `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` in the environment that bundles the app; do not place its value in source code.

**Why:** The user clarified that OG Landmark maps use Mapbox, not Google Maps.

**How to apply:** Keep Android and iOS native map screens on `ExpoGoMapFallback`; before any future Android build, verify the selected EAS environment contains the Mapbox token without printing or exposing its value.

For this project, make only the requested change. Do not start an EAS APK build unless the user explicitly requests that specific build; approval for an earlier APK is not ongoing permission.

**Why:** The user reiterated on 2026-10-03 that source updates must not trigger an APK build.

**How to apply:** Keep requested fixes source-only until the user asks for a new APK. Never submit a build to an app store unless separately asked.

Keep the WebView map document stable and push marker, center, and radius updates through `injectJavaScript`; rebuilding the HTML source on every parent render makes returning from a property detail feel like a fresh map load.

**Why:** Explore data and filter state can rerender while the user navigates, and a remote Leaflet document otherwise re-downloads its scripts and tiles unnecessarily.

**How to apply:** Initialize the map HTML once per mounted fallback, cache the WebView, keep the native WebView touch stream enabled while locking HTML overflow, use the explicit pinch bridge/zoom controls, and update the radius circle center from map movement events.

The user confirmed on 2026-10-03 that the updated Android APK's map is now working correctly.

**Why:** This is direct user confirmation of the delivered map fix.

**How to apply:** Treat this as confirmation for the delivered APK only; verify any later map build separately.