---
name: Notification delivery pipeline
description: Durable rules for OG Landmark notification records, deduplication, preferences, and push delivery.
---

All notification sources, including legacy admin broadcasts, should pass through the same per-user notification creation and delivery pipeline. Deduplication keys must be namespaced by recipient so one event is deduplicated independently for each eligible user. Soft deletion is user-scoped and must not remove another user's copy.

**Why:** A shared pipeline prevents lifecycle-triggered pushes and older broadcast routes from creating duplicate system alerts or bypassing notification-center history and preferences.

**How to apply:** When adding a new property, project, announcement, or account event, resolve recipients first, create one durable record per recipient, then send push only when that recipient's preferences and delivery frequency allow it.