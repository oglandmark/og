---
name: Expo Router root route
description: Prevent duplicate root paths from redirecting the browser preview back to itself.
---

Use only one route for `/` when a grouped tab index already maps to the root path. Do not add a separate `app/index.tsx` redirect to `/(tabs)`.

**Why:** Expo Router hides route-group names in URLs, so `/(tabs)` resolves to `/`. A second root index redirect can send the browser back to the same path and make the Replit preview appear to reload repeatedly.

**How to apply:** Keep `app/(tabs)/index.tsx` as the sole root route and add a route-regression check if startup routing changes.
