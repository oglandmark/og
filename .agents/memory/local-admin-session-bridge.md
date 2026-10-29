---
name: Local admin session bridge
description: How Laravel admin APIs validate the website's in-memory sessions during local preview.
---

In Replit local preview, the website can keep bearer sessions in its Express process instead of Laravel's `auth_sessions` table. A local Laravel API request must validate that existing token against the website's authenticated-user endpoint, then still run Laravel's role/permission middleware. Keep this fallback disabled outside `APP_ENV=local`.

**Why:** Switching admin screens to Laravel in preview otherwise makes a valid existing website session look expired, while removing Laravel authorization would weaken the admin boundary.

**How to apply:** Keep the local verifier URL configurable, use a short request timeout, and verify both an admin and a regular user. Production must continue to use the persisted Laravel-compatible session table only.

The local Laravel `/auth/me` response wraps the account as `{ user: ... }`, while the legacy Express endpoint returns the account directly. Normalize both response shapes before the Admin browser checks the role.

**Why:** The Admin bridge serves both backends; treating Laravel's valid wrapped response as a user object makes session recovery clear a valid token and redirect to login.

**How to apply:** Unwrap the optional `user` field in both page-load recovery and existing-session login recovery, and test wrapped and direct responses.

Local preview bearer sessions are persisted as token hashes in a private, ignored runtime file so browser reloads and web workflow restarts do not sign the Admin out. The file remains local-only; production sessions continue using `auth_sessions`.

**Why:** The user asked that refreshing local Admin should not end the session, and in-memory-only sessions became invalid when the web process restarted.

**How to apply:** Keep session hashes, user IDs, and expiries in the private preview store; persist login, logout, expiry, and password-reset revocation. Never enable this store outside local preview.
