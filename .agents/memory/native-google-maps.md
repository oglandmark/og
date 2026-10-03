---
name: Native Android Google Maps provider
description: Android APK map provider and secure EAS key injection for the OG Landmark mobile app.
---

Android APK map surfaces use the Google Maps SDK through `react-native-maps`; its API key must come from an EAS environment at build time and be restricted to the Android package and signing certificate. Keep the key out of app config and source files. The internal preview profile must select the EAS environment that contains that key.

**Why:** EAS preview builds did not receive the Mapbox token, which left Android map tiles blank. The configured Google Maps SDK key is present in the production EAS environment and can be injected without exposing it in source.

**How to apply:** For Android, use `GoogleMapCanvas` with street/satellite map types and marker/region callbacks; fail the build if the configured EAS environment lacks the key. Keep iOS and Expo Go on the shared Mapbox WebView path until the Mapbox token is provisioned in their EAS environment.

For the Expo Go fallback, keep the WebView document stable and push marker, center, and radius updates through `injectJavaScript`; rebuilding the HTML source on every parent render makes returning from a property detail feel like a fresh map load.

**Why:** Explore data and filter state can rerender while the user navigates, and a remote Leaflet document otherwise re-downloads its scripts and tiles unnecessarily.

**How to apply:** Initialize the map HTML once per mounted fallback, cache the WebView, keep the native WebView touch stream enabled while locking HTML overflow, use the explicit pinch bridge/zoom controls, and update the radius circle center from map movement events.