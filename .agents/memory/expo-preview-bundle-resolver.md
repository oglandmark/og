---
name: Expo preview bundle routing
description: Distinguish Expo Go's native bundle host from shared web/API routing when preview requests time out.
---

For Expo previews, set `REACT_NATIVE_PACKAGER_HOSTNAME` to `REPLIT_EXPO_DEV_DOMAIN`; keep local admin authentication on the Expo same-origin API route. If the public property feed must read production directly, Laravel CORS must explicitly allow the Replit Expo host family and GET only. Editing the workspace config does not change a separately deployed Hostinger API; confirm the deployed preflight before removing any local fallback.

**Why:** The local SQLite preview can be connected but empty, and the production API may reject browser requests from the Replit Expo origin. Mixing local auth with production public listings requires separate API bases; direct production fetches only work after the external CORS config is deployed.

**How to apply:** Verify Expo launch-asset routing and the live API's `OPTIONS` response for the actual preview origin. Keep admin sign-in and writes on the local API; normalize direct live property media against `https://www.oglandmark.com`. If external CORS cannot be updated, use only narrow read-only local proxy routes guarded to local preview, and do not claim the live switch is complete.