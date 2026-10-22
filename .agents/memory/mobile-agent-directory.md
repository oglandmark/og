---
name: Mobile Agent directory
description: Keep the bundled mobile Agent fallback and Admin-managed Agent directory consistent.
---

The mobile app may display bundled Agent profiles when its API directory is unavailable or has not loaded. Import those legacy profiles into the managed API directory only once; after a successful API response, an empty directory must remain empty so an Admin deletion does not reveal deleted bundled profiles again.

Agent cards can share a public contact phone. Do not use that phone alone as a unique profile key when it appears multiple times; keep distinct Agent IDs/names and only merge when an account or email links them, or when phone plus name identifies the same profile.

**Why:** Mobile and website Agent records are separate sources. Mixing website-only records into the mobile endpoint or creating mobile profiles in the website collection makes the wrong Agents appear in the app and disconnects Admin edits from the app's directory.

**How to apply:** Keep `mobileAgents` canonical for Admin mobile management and `/api/mobile-agents`; let `/api/agents` include mobile records for the website. Create Admin mobile profiles in `mobileAgents`. Bypass HTTP caching and refresh while Home/profile screens are focused. Preserve the one-time import marker and distinguish API failure from a successful empty list.
