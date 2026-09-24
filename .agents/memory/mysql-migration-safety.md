---
name: MySQL migration safety
description: Rules for completing the OG Landmark PostgreSQL-to-MySQL cutover without data loss.
---

The existing Hostinger MySQL database still contains live users and listings and is the selected Laravel source of truth. Reuse it directly; a verified source snapshot is required only when copying to a different target. Repository seed JSON is not evidence of production parity.

**Why:** The application stores its canonical state as one JSON document, so a successful schema migration alone cannot prove that users, listings, sessions, and challenges were preserved. Replacing the still-live MySQL document with the repository snapshot would lose production changes.

**How to apply:** Back up the existing MySQL database and matching media, configure Laravel to use that same server-only MySQL connection, clear stale cached settings, run non-destructive migrations without seeding or importing, then verify the live listings and connected MySQL health response before routing traffic.