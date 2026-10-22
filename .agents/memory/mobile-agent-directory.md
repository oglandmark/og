---
name: Mobile Agent directory
description: Keep the bundled mobile Agent fallback and Admin-managed Agent directory consistent.
---

The Admin dashboard is the source of truth for public Agent visibility. Import bundled legacy profiles into the managed directory once so Admin can edit or remove them; never show unmanaged bundled Agents as a fallback after the API directory is empty or unavailable.

Agent cards can share a public contact phone. Do not use that phone alone as a unique profile key when it appears multiple times; keep distinct Agent IDs/names and only merge when an account or email links them, or when phone plus name identifies the same profile.

**Why:** Agents visible in the app or website must be manageable from Admin. Unmanaged bundled profiles can reappear after deletion, and website-only records otherwise remain invisible to the Agent dashboard.

**How to apply:** Load both `cityAgents` and `mobileAgents` in Admin; create new shared profiles in `mobileAgents`, and update/delete every linked source. Keep `/api/mobile-agents` restricted to mobile records and `/api/agents` inclusive of both sources. Use a one-time sample-import marker; never re-import deleted profiles. Refresh app data on focus, and treat API failure or an empty directory as no public Agents.
