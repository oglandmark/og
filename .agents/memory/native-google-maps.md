---
name: Native Mapbox provider
description: Native map provider and token constraints for the OG Landmark mobile app.
---

Native iOS and Android map surfaces now use the same Mapbox-backed WebView renderer as Expo Go. Platform-specific wrapper files must re-export the shared implementation rather than maintaining separate provider paths, so pan, pinch zoom, pins, area search, and draggable location pins behave consistently.

**Why:** The prior Google SDK path diverged from the preview renderer and depended on platform-restricted native keys. A shared Mapbox surface makes the physical-device and Expo Go behavior observable through one implementation and avoids blank native SDK surfaces when a build key is unavailable.

**How to apply:** Keep `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` out of source and inject the public token through the Expo environment. Keep Mapbox Streets tiles, Leaflet touch handling, marker callbacks, and area-region callbacks in the shared fallback; platform wrappers should remain thin re-exports.

For the Expo Go fallback, keep the WebView document stable and push marker, center, and radius updates through `injectJavaScript`; rebuilding the HTML source on every parent render makes returning from a property detail feel like a fresh map load.

**Why:** Explore data and filter state can rerender while the user navigates, and a remote Leaflet document otherwise re-downloads its scripts and tiles unnecessarily.

**How to apply:** Initialize the map HTML once per mounted fallback, cache the WebView, keep the native WebView touch stream enabled while locking HTML overflow, use the explicit pinch bridge/zoom controls, and update the radius circle center from map movement events.