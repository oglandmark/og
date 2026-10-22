---
name: Mobile Agent directory
description: Keep the bundled mobile Agent fallback and Admin-managed Agent directory consistent.
---

The mobile app may display bundled Agent profiles when its API directory is unavailable or has not loaded. Import those legacy profiles into the managed API directory only once; after a successful API response, an empty directory must remain empty so an Admin deletion does not reveal deleted bundled profiles again.

**Why:** The Admin directory was empty while the mobile app still showed locally bundled Agent cards, so there were no records for Edit/Delete actions to target.

**How to apply:** When changing Agent directory sync, preserve a durable one-time import marker and distinguish API load failure from a successful empty list in the mobile UI.
