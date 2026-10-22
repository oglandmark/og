---
name: Browser admin extensions
description: How to add maintainable features to the static browser admin when its original application source is unavailable.
---

The website must have one Admin Dashboard at `/admin/`, using the existing compiled React dashboard to manage the Laravel-backed website and mobile platform. Keep legacy admin URLs routed to that same dashboard.

For admin and listing work in this project, update the website admin dashboard and keep its local Replit preview synchronized and verified with each change.

Only change the website Admin Dashboard and the minimum Laravel integration needed for its requested functions. Do not change the mobile app UI or unrelated website sections.

When replacing a website logo, use a new asset URL instead of relying on overwriting an existing static path; the preview can keep serving the cached prior image. Precompiled admin/user bundles still reference `/og-logo.png`, so route those image elements to the new official inverse mark with the website compatibility script.

**Why:** Website static assets are cached as immutable, and the old compiled bundle hardcodes the previous logo path.

**How to apply:** Add versioned official navy/white logo assets, update HTML and favicon references, and keep the bundle compatibility shim scoped to image URLs only.

**Why:** The user explicitly asked to keep and update the older React Admin Dashboard rather than replace it with a separate React Native Web dashboard; only the website dashboard may change.

**How to apply:** Preserve the existing React bundle and make maintainable additions through separately loaded admin modules; route legacy admin entry points to `/admin/`, reuse Laravel authentication/APIs, preserve mobile API compatibility, and verify the local web preview. Do not alter the mobile client UI.

The admin dashboard must show all mobile property listings by default across statuses, with status filters, full edit/delete controls, and cross-city agent referrals. A referral must target a linked active Agent account so it appears in the Agent portal.

**Why:** The user clarified that all currently live mobile listings—not only pending submissions—must be visible and manageable from the website admin.

**How to apply:** Load the complete authenticated admin property collection without silently limiting the default result set; keep pending and other status filters available; validate Agent accounts server-side, persist their account ID as `agentId`, and notify the assigned agent.

The user wants the website Admin Dashboard to show the live mobile app's current Properties, Agent profiles/accounts, Users, Homepage banners, and Notifications, with edit/update/delete controls. Replit preview should use the production API only when the user explicitly requests that live connection; never substitute bundled demo records for live listings.

**Why:** The user explicitly requested production-backed management of these mobile app records from the website dashboard.

**How to apply:** Use the existing Laravel admin APIs and preserve their auth and notification-delivery rules. Keep Agent directory profiles distinct from Agent login accounts, and confirm account/data deletion behavior before adding irreversible production controls.
