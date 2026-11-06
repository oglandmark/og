---
name: Mobile Agent directory
description: Keep the bundled mobile Agent fallback and Admin-managed Agent directory consistent.
---

The Admin Agents page manages Mobile app Agent profiles only. Do not list website-only Agent profiles there; website profiles may enrich a Mobile profile only when an account link identifies the same Agent.

The public Website Agent directory must enforce the same active, approved, and visible checks as the Mobile directory. Do not assume that a record in `mobileAgents` or `cityAgents` is automatically public.

Agent cards can share a public contact phone. Do not use that phone alone as a unique profile key when it appears multiple times; keep distinct Agent IDs/names and only merge when an account or email links them, or when phone plus name identifies the same profile.

**Why:** The user clarified that Admin Agents is specifically for Mobile app Agents; website-only profiles in that list are misleading and can be mistaken for app profiles.

**How to apply:** Build Admin Agents rows from the Mobile directory and the Mobile app's public feed. Use website profiles only to fill missing city/contact details for a linked Mobile Agent, never as standalone rows or assignment options. Keep `/api/mobile-agents` restricted to mobile records and `/api/agents` inclusive of both sources. Publish only Admin-created records; legacy seed/demo profiles stay private. Apply status, approval, and visibility gates on every public Website and Mobile surface. Use a one-time sample-import marker; never re-import deleted profiles. Refresh app data on focus, and treat API failure or an empty directory as no public Agents.

## Admin-managed Projects

Admin-created developer projects intended for the public mobile app should default to `Live`; keep `Draft` and `Pending Review` as explicit private states. The Explore Projects feed must refresh on focus/resume and distinguish loading, empty, and failed states.

**Why:** The product owner expects Admin-managed Agents and Projects to be discoverable in the mobile app. Draft projects are intentionally excluded from the public API, and a one-time client fetch can leave newly published projects stale.

**How to apply:** Keep the public project API restricted to `Live` or `Approved` records, default new Admin entries to `Live`, and require existing Draft/Pending entries to be explicitly published before they appear.

Public project detail screens must render the core project response without waiting for developer-only inventory or payment-plan requests. Treat those supplementary requests as optional for buyer access.

**Why:** The public project endpoint allows buyers, while inventory and payment-plan endpoints require a developer account; coupling them to the main loading state can leave public details stuck loading.

**How to apply:** Load the public project first and render it independently. Keep authenticated-only supplementary calls non-blocking and handle their failures without hiding the project name or description.

Admin deletions of bundled demo properties/projects update shared mobile settings; the packaged copies are not removed from the app bundle. Refresh those settings when the app resumes and periodically while it remains open so the local copies stop appearing.

**Why:** Deleting the backend row or adding a hidden ID does not mutate assets bundled in the mobile app, and one-time settings hydration leaves deleted demos visible in an already-open app.

**How to apply:** Filter bundled copies by the Admin-managed hidden/deleted IDs and re-fetch mobile settings on resume and at a modest interval.
