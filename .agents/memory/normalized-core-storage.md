---
name: Normalized core storage
description: Durable design constraints for moving OG Landmark users, properties, agents, and media references out of app_data.
---

Keep the normalized application-account table named `app_users` rather than reusing Laravel's scaffold `users` table. Keep each complete legacy entity payload in its relational row, preserve `app_data`, and dual-write both representations after activation.

**Why:** Laravel's scaffold already owns the generic `users` table, while OG Landmark's login and API contract use the legacy account fields and mixed ID types. Retaining `app_data` and full payloads preserves rollback and response compatibility.

**How to apply:** Use the explicit one-time normalization command against the existing database only after a verified backup and a quiet write window. Keep media bytes in persistent storage and normalize their URL references, not the files themselves.

Do not use an older Hostinger backend archive as the current production source unless it includes `NormalizedCoreStore` and routes JSON writes through the active dual-write path. A legacy account-deletion patch could remove a user from `app_data` while leaving normalized rows behind. Build deployment packages from current Laravel source when that compatibility is missing, and exclude bundled `.env`, runtime storage, sessions, logs, imports, and test credentials.

**Why:** A supplied legacy backend archive had no `NormalizedCoreStore` and contained local runtime/test data, so it was unsafe to use as the base for production deletion code.

**How to apply:** Compare a supplied backend archive with the active Laravel storage implementation before merging changes; preserve the current source-of-truth path and never package local runtime data.