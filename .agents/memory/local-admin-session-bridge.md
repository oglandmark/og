---
name: Local admin session bridge
description: How Laravel admin APIs validate the website's in-memory sessions during local preview.
---

In Replit local preview, the website can keep bearer sessions in its Express process instead of Laravel's `auth_sessions` table. A local Laravel API request must validate that existing token against the website's authenticated-user endpoint, then still run Laravel's role/permission middleware. Keep this fallback disabled outside `APP_ENV=local`.

**Why:** Switching admin screens to Laravel in preview otherwise makes a valid existing website session look expired, while removing Laravel authorization would weaken the admin boundary.

**How to apply:** Keep the local verifier URL configurable, use a short request timeout, and verify both an admin and a regular user. Production must continue to use the persisted Laravel-compatible session table only.

Laravel wraps `/auth/me` as `{ user: ... }`, while the website Express endpoint returns the account directly. Normalize both shapes in browser recovery and in Laravel's local website-session verifier before checking permissions.

**Why:** Admin list requests pass through Laravel while the website login session belongs to Express; an unwrapped Express response otherwise looks like an unauthenticated request.

**How to apply:** Unwrap the optional `user` field at every local-session boundary and test both response shapes with admin and regular-user permissions.

Local preview bearer sessions are persisted as token hashes in a private, ignored runtime file so browser reloads and web workflow restarts do not sign the Admin out. The file remains local-only; production sessions continue using `auth_sessions`.

**Why:** The user asked that refreshing local Admin should not end the session, and in-memory-only sessions became invalid when the web process restarted.

**How to apply:** Keep session hashes, user IDs, and expiries in the private preview store; persist login, logout, expiry, and password-reset revocation. Never enable this store outside local preview.

The local Express `/api/auth/me` endpoint shares a 30-request authentication limit with other auth paths. Since Laravel validates an Express-owned bearer token for each protected request, cache only successful local user validations by the token hash for 60 seconds in Laravel's file cache; continue running Laravel permission checks on every request.

**Why:** Repeated Admin page requests exhausted the website auth limit, and Laravel surfaced the resulting 429 as “Authentication required.”

**How to apply:** Keep this cache inside the `APP_ENV=local` fallback, never cache failed validation, and remember that a local logout or permission change can take up to 60 seconds to take effect.
