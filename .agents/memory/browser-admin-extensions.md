---
name: Browser admin extensions
description: How to add maintainable features to the static browser admin when its original application source is unavailable.
---

The website must have one Admin Dashboard at `/admin/`, using the existing compiled React dashboard to manage the Laravel-backed website and mobile platform. Keep legacy admin URLs routed to that same dashboard.

For admin and listing work in this project, update the website admin dashboard and keep its local Replit preview synchronized and verified with each change.

Only change the website Admin Dashboard and the minimum Laravel integration needed for its requested functions. Do not change the mobile app UI or unrelated website sections.

**Why:** The user explicitly asked to keep and update the older React Admin Dashboard rather than replace it with a separate React Native Web dashboard; only the website dashboard may change.

**How to apply:** Preserve the existing React bundle and make maintainable additions through separately loaded admin modules; route legacy admin entry points to `/admin/`, reuse Laravel authentication/APIs, preserve mobile API compatibility, and verify the local web preview. Do not alter the mobile client UI.
