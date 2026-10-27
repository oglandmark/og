---
name: Browser admin extensions
description: How to add maintainable features to the static browser admin when its original application source is unavailable.
---

The website must have one Admin Dashboard at `/admin/`, using the existing compiled React dashboard to manage the Laravel-backed website and mobile platform. Keep legacy admin URLs routed to that same dashboard.

All custom management pages must stay inside this shared dashboard shell. Do not mount fixed full-screen page overlays that replace its header and navigation; render the routed page content within the existing main area.

**Why:** The user wants a single Admin Dashboard, not separate-looking dashboards for different sections.

**How to apply:** Reuse the existing React sidebar and top bar for every admin destination, and replace only the main content area when a custom page is opened.

For admin and listing work in this project, update the website admin dashboard and keep its local Replit preview synchronized and verified with each change.

Only change the website Admin Dashboard and the minimum Laravel integration needed for its requested functions. Do not change the mobile app UI or unrelated website sections.

When replacing a website logo, use a new asset URL instead of relying on overwriting an existing static path; the preview can keep serving the cached prior image. Precompiled admin/user bundles still reference `/og-logo.png`, so route those image elements to the new official inverse mark with the website compatibility script.

**Why:** Website static assets are cached as immutable, and the old compiled bundle hardcodes the previous logo path.

**How to apply:** Add versioned official navy/white logo assets, update HTML and favicon references, and keep the bundle compatibility shim scoped to image URLs only.

**Why:** The user explicitly asked to keep and update the older React Admin Dashboard rather than replace it with a separate React Native Web dashboard; only the website dashboard may change.

**How to apply:** Preserve the existing React bundle and make maintainable additions through separately loaded admin modules; route legacy admin entry points to `/admin/`, reuse Laravel authentication/APIs, preserve mobile API compatibility, and verify the local web preview. Do not alter the mobile client UI.

Keep local preview API rewrites in the shared `og-api-base.js` shim and cover them in `admin-laravel-routing.test.js`; do not add per-page URL switches. Production hosts must retain their existing API routing.

**Why:** The shared shim already owns the preview-versus-production routing boundary, and duplicating it in a page can send requests to different backends.

**How to apply:** Add local Laravel route rewrites centrally and test both Replit preview paths and unchanged production paths.

The admin dashboard must show all mobile property listings by default across statuses, with status filters, full edit/delete controls, and cross-city agent referrals. A referral must target a linked active Agent account so it appears in the Agent portal.

**Why:** The user clarified that all currently live mobile listings—not only pending submissions—must be visible and manageable from the website admin.

**How to apply:** Load the complete authenticated admin property collection without silently limiting the default result set; keep pending and other status filters available; validate Agent accounts server-side, persist their account ID as `agentId`, and notify the assigned agent.

The user wants the website Admin Dashboard to show the live mobile app's current Properties, Agent profiles/accounts, Users, Homepage banners, and Notifications, with edit/update/delete controls. Replit preview should use the production API only when the user explicitly requests that live connection; never substitute bundled demo records for live listings.

**Why:** The user explicitly requested production-backed management of these mobile app records from the website dashboard.

**How to apply:** Use the existing Laravel admin APIs and preserve their auth and notification-delivery rules. Keep Agent directory profiles distinct from Agent login accounts, and confirm account/data deletion behavior before adding irreversible production controls.

New property submissions should appear in the Property listed review inbox regardless of status. Featured and Recommended promotion controls must remain disabled until both approval and listing status are active or approved, and the API must reject attempts to promote an unapproved listing.

**Why:** The user wants Admins to review new listings first, then feature them only after approval.

**How to apply:** Keep the inbox unfiltered by status and enforce promotion eligibility in both the dashboard controls and the authenticated Admin API.

The property-list filter bar should keep Status and City controls, but not the Category, Featured, Recommended, or Mobile Home chip groups; use the dedicated sidebar pages for those views.

**Why:** The user asked to remove the extra filter-chip groups from the property list after adding dedicated navigation pages.

**How to apply:** Keep route-based filters for the dedicated Featured, Recommended, Projects, and Agriculture Land pages, while omitting those groups from the visible filter bar.

Public-facing Admin changes must be reflected consistently on both the Website and Mobile app, including property edits/status/promotions, agent and project directory changes, banners, and app content settings.

**Why:** The user explicitly asked for complete end-to-end synchronization from Admin to Website and Mobile.

**How to apply:** Keep these surfaces on the canonical Laravel-backed data source; make website responses fresh on navigation/reload and give open mobile screens a bounded refresh and app-resume path. Keep private account and moderation data scoped to authorized users.
