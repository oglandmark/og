---
name: Browser admin extensions
description: How to add maintainable features to the static browser admin when its original application source is unavailable.
---

The website must have one Admin Dashboard, built with React Native Web, and it manages the existing Laravel-backed website and mobile platform. Keep the dashboard at the website's admin entry point and route legacy admin URLs to that same dashboard.

For admin and listing work in this project, update the website admin dashboard and keep its local Replit preview synchronized and verified with each change.

Only change the website Admin Dashboard and the minimum Laravel integration needed for its requested functions. Do not change the mobile app UI or unrelated website sections.

**Why:** The user explicitly requires one React Native website dashboard to manage the Laravel-backed website and mobile platform, while preserving mobile screens and unrelated website pages.

**How to apply:** Use React Native Web for the website-facing admin UI, route all legacy admin entry points to it, and reuse Laravel authentication/APIs. Touch Laravel only when needed, preserve mobile API compatibility, and verify the local web preview. Do not alter the mobile client UI.
