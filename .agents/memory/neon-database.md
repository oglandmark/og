---
name: Neon PostgreSQL production database
description: Durable database-provider decision for OG Landmark production deployments.
---

OG Landmark production uses the user's Neon PostgreSQL database, accessed server-side through `DATABASE_URL`; Supabase is not the production provider.

**Why:** The user explicitly chose to keep using the original Neon/PostgreSQL database rather than switching the website to Supabase.

**How to apply:** Keep database credentials out of browser code, public files, Git, and chat. Apply `database/schema.sql` in Neon, set `DATABASE_URL` in the deployment environment, and verify `/api/health` reports `databaseProvider: "neon"`.