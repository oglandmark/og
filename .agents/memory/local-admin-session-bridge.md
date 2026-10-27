---
name: Local admin session bridge
description: How Laravel admin APIs validate the website's in-memory sessions during local preview.
---

In Replit local preview, the website can keep bearer sessions in its Express process instead of Laravel's `auth_sessions` table. A local Laravel API request must validate that existing token against the website's authenticated-user endpoint, then still run Laravel's role/permission middleware. Keep this fallback disabled outside `APP_ENV=local`.

**Why:** Switching admin screens to Laravel in preview otherwise makes a valid existing website session look expired, while removing Laravel authorization would weaken the admin boundary.

**How to apply:** Keep the local verifier URL configurable, use a short request timeout, and verify both an admin and a regular user. Production must continue to use the persisted Laravel-compatible session table only.
