---
name: Expo preview bundle routing
description: Distinguish Expo Go's native bundle host from shared web/API routing when preview requests time out.
---

For native Expo Go previews, set `REACT_NATIVE_PACKAGER_HOSTNAME` to `REPLIT_EXPO_DEV_DOMAIN`; keep `EXPO_PUBLIC_DOMAIN` on `REPLIT_DEV_DOMAIN` for API routing. A healthy web preview does not prove native preview works. Check that the Expo manifest's `launchAsset.url` uses the Expo domain and that the bundle returns JavaScript.

**Why:** Replit's Expo manifest advertised the native bundle on the shared web domain, where the app's marketing page was returned instead of JavaScript. Expo Go showed a request timeout even though Metro and the web renderer were healthy.

**How to apply:** Verify the manifest and launch asset over the Expo domain for both iOS and Android. Separately diagnose 404 bundle-path errors: Metro can resolve a proxied web bundle from the monorepo root rather than the app package. Do not change managed artifact routing speculatively; confirm the exact failing URL and response first.