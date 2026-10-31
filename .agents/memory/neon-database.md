---
name: Production database runtime parity
description: Keep the current Supabase production database distinct from the deleted Hostinger API runtime and local preview.
---

The user confirms the current production database is Supabase PostgreSQL, not Hostinger MySQL. The public website still calls `https://api.oglandmark.com/api`; the user deleted that API subdomain and its app, so restoring Supabase connectivity also requires an API server and DNS mapping.

**Why:** The user corrected the previous MySQL assumption while diagnosing registration, login, and password-reset failures. The source repository contains legacy MySQL/Laravel deployment notes, but current user-provided production state takes precedence.

**How to apply:** Keep Supabase data intact; do not restore/import/seed MySQL over it. Deploy a current server-side API using the private Supabase `DATABASE_URL`, then restore `api.oglandmark.com` to that API and verify health and auth routes. Never put database credentials in browser code, ZIPs, Git, or chat.