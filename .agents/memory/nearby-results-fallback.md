---
name: Nearby results fallback
description: Geographic catalogue queries must preserve the mobile fallback catalogue when the remote response is empty.
---

Nearby filtering must not replace the existing mobile property cache with an empty remote page. The UI should keep bundled or previously loaded properties so its client-side radius filter remains usable during an empty result, unavailable database, or temporary API failure.

**Why:** The nearby request can legitimately return no rows, and the deployed catalogue may temporarily be unavailable; clearing the cache makes a successful GPS lookup look like a broken Near Me action.

**How to apply:** When adding geo-scoped fetches or pagination, update the remote cache only when a usable page is returned, and keep exact-distance filtering before server-side pagination.