---
name: Notification delivery pipeline
description: Durable rules for OG Landmark notification records, deduplication, preferences, and push delivery.
---

All notification sources, including legacy admin broadcasts, should pass through the same per-user notification creation and delivery pipeline. Deduplication keys must be namespaced by recipient so one event is deduplicated independently for each eligible user. Soft deletion is user-scoped and must not remove another user's copy.

**Why:** A shared pipeline prevents lifecycle-triggered pushes and older broadcast routes from creating duplicate system alerts or bypassing notification-center history and preferences.

**How to apply:** When adding a new property, project, announcement, or account event, resolve recipients first, create one durable record per recipient, then send push only when that recipient's preferences and delivery frequency allow it.

When API traffic is proxied to Laravel, Laravel must own scheduled announcement delivery against the canonical `app_data` document. Do not run the legacy Node scheduler at the same time; both runtimes can overwrite the same JSON snapshot.

**Why:** A second scheduler or database-backed startup path can race Laravel API writes and lose notification or listing updates.

**How to apply:** Configure the Laravel scheduled command and Hostinger's minute-level cron before relying on scheduled broadcasts. Keep the Node database disconnected while Laravel is primary; restore it only as part of a rollback.