---
name: Laravel config cache smoke checks
description: Laravel endpoint smoke tests must clear stale config before overriding database settings locally.
---

Laravel's non-production health check can report a connected database after `SELECT 1` succeeds even when `JsonStore` is reading a different connection and falling back to an empty document.

**Why:** A cached `DB_URL` can outlive shell overrides, so health and import commands may appear successful while listing reads use the wrong database.

**How to apply:** Clear config before local connection overrides, then verify both `app_data` parity and a real listing response; production config must be cached only after the final MySQL values are installed.