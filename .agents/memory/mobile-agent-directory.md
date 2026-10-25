---
name: Mobile Agent directory
description: Keep the bundled mobile Agent fallback and Admin-managed Agent directory consistent.
---

The Admin dashboard is the source of truth for public Agent visibility. Import bundled legacy profiles into the managed directory once so Admin can edit or remove them; never show unmanaged bundled Agents as a fallback after the API directory is empty or unavailable.

Agent cards can share a public contact phone. Do not use that phone alone as a unique profile key when it appears multiple times; keep distinct Agent IDs/names and only merge when an account or email links them, or when phone plus name identifies the same profile.

**Why:** Agents visible in the app or website must be manageable from Admin. Unmanaged bundled profiles can reappear after deletion, and website-only records otherwise remain invisible to the Agent dashboard.

**How to apply:** Load both `cityAgents` and `mobileAgents` in Admin; create new shared profiles in `mobileAgents`, and update/delete every linked source. Keep `/api/mobile-agents` restricted to mobile records and `/api/agents` inclusive of both sources. Use a one-time sample-import marker; never re-import deleted profiles. Refresh app data on focus, and treat API failure or an empty directory as no public Agents.

## Admin-managed Projects

Admin-created developer projects intended for the public mobile app should default to `Live`; keep `Draft` and `Pending Review` as explicit private states. The Explore Projects feed must refresh on focus/resume and distinguish loading, empty, and failed states.

**Why:** The product owner expects Admin-managed Agents and Projects to be discoverable in the mobile app. Draft projects are intentionally excluded from the public API, and a one-time client fetch can leave newly published projects stale.

**How to apply:** Keep the public project API restricted to `Live` or `Approved` records, default new Admin entries to `Live`, and require existing Draft/Pending entries to be explicitly published before they appear.

Admin deletions of bundled demo properties/projects update shared mobile settings; the packaged copies are not removed from the app bundle. Refresh those settings when the app resumes and periodically while it remains open so the local copies stop appearing.

**Why:** Deleting the backend row or adding a hidden ID does not mutate assets bundled in the mobile app, and one-time settings hydration leaves deleted demos visible in an already-open app.

**How to apply:** Filter bundled copies by the Admin-managed hidden/deleted IDs and re-fetch mobile settings on resume and at a modest interval.
