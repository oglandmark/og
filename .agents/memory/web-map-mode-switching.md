---
name: Web map iframe mode switching
description: Reliable map-style control across the proxied Explore iframe.
---

For the web map overlays, update the active same-origin Blob iframe through its exposed map-mode setter after it loads; use channel-scoped `postMessage` only as a pre-load fallback.

**Why:** Real taps in the Replit-proxied preview showed that scoped messages did not reliably trigger the map-style handler, while calling the frame setter changed the Mapbox tiles.

**How to apply:** Keep a direct frame API and a scoped pre-load fallback for same-origin web map frames. Keep React Native WebView mode switching on `injectJavaScript`, and reassess if a frame becomes cross-origin.