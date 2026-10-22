---
name: Mobile Agent directory
description: Keep the bundled mobile Agent fallback and Admin-managed Agent directory consistent.
---

The mobile app may display bundled Agent profiles when its API directory is unavailable or has not loaded. Import those legacy profiles into the managed API directory only once; after a successful API response, an empty directory must remain empty so an Admin deletion does not reveal deleted bundled profiles again.

Agent cards can share a public contact phone. Do not use that phone alone as a unique profile key when it appears multiple times; keep distinct Agent IDs/names and only merge when an account or email links them, or when phone plus name identifies the same profile.

**Why:** Admin-managed Agent profiles can change while the mobile app remains open, and Expo Router may keep detail screens mounted when navigating away and back. A one-time mount fetch can leave photo and profile details stale after an Admin save.

**How to apply:** Refresh managed Agent details when the profile screen regains focus. When changing directory sync, preserve a durable one-time import marker and distinguish API load failure from a successful empty list in the mobile UI.
