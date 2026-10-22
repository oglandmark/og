---
name: Admin project lifecycle
description: Preserve developer project inventory and admin audit history when managing projects through the website dashboard.
---

Admin project mutations should pass through the authenticated `/admin/developer-projects` route, which records activity. Project deletion should archive the project rather than physically removing it, so linked inventory records remain intact.

**Why:** Developer projects own blocks, units, and other records keyed by project ID; bypassing the admin route skips the central activity log, while physical deletion leaves those records orphaned.

**How to apply:** Keep website-admin project workflows on the admin API wrapper and reuse `DeveloperApiService` archive behavior for delete actions.
