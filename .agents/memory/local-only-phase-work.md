---
name: Local-only phase work
description: Environment boundary for the ongoing OG Landmark integration phases.
---

For the 12-phase OG Landmark integration, keep all phase changes and verification in the local Replit preview/backend. Do not deploy to or update production, including production records, unless the user explicitly changes this instruction.

For local property management, a read-only public catalogue snapshot may be imported into Replit's local store so the Admin dashboard and preview app share one catalogue. Admin and Mobile preview edits must remain local; never send them to production.

**Why:** The user asked to continue the phases locally for now and not update production.

**How to apply:** Use the local Laravel/API and website preview for implementation and tests. Treat Hostinger/public API and production data as read-only and out of scope; use public reads only to seed the local catalogue when needed.
