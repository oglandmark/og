---
name: Expo preview bundle routing
description: Distinguish Expo Go's native bundle host from shared web/API routing when preview requests time out.
---

For Expo previews, set `REACT_NATIVE_PACKAGER_HOSTNAME` and the local property-feed/media host to `REPLIT_EXPO_DEV_DOMAIN`. The Expo host can serve the path-prefixed Laravel API route, keeping those browser requests same-origin; confirm the exact route before relying on it. Keep unrelated mobile API calls on their configured API origin when the local Laravel backend does not implement them. A healthy web preview does not prove native preview works. Check that the Expo manifest's `launchAsset.url` uses the Expo domain and that the bundle returns JavaScript.

When the local preview database has no public catalogue or settings, direct browser requests from the Expo origin to production may fail CORS. Use narrowly allowlisted, read-only same-origin Laravel proxy routes guarded by `APP_ENV=local`; keep local authentication and writes on the preview API, and normalize proxied listing media against the live API origin.

**Why:** Replit's Expo manifest advertised the native bundle on the shared web domain, where the app's marketing page was returned instead of JavaScript. Later, local property API calls from the Expo web host to the shared web host failed CORS preflight, while the same path worked on the Expo host. The Laravel preview may not implement newer settings or banner endpoints, so moving all mobile traffic to it causes unrelated 404s.

**Why:** The local SQLite preview can be connected but empty, and the production API does not allow the Replit Expo origin. A read-only local proxy keeps public preview data working without exposing a general proxy or moving local admin writes to production.

**How to apply:** Verify the manifest, launch asset, public property feed, and generated media URL over the Expo domain for both iOS and Android. Separately diagnose 404 bundle-path errors: Metro can resolve a proxied web bundle from the monorepo root rather than the app package. Keep any live-data proxy limited to named public GET routes and disabled outside local preview. Do not change managed artifact routing speculatively; confirm the exact failing URL and response first.