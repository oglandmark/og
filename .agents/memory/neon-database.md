---
name: Production database runtime parity
description: Keep Supabase as production storage and route the Hostinger website to its active root-domain Express API.
---

The user confirms the production database is Supabase PostgreSQL. The root Hostinger Express app responds at `https://oglandmark.com/api/health`; when checked, it reported `DATABASE_URL` missing. The `api.oglandmark.com` subdomain was created as a normal website and does not currently route to the Node API. Production web API calls now target `https://oglandmark.com/api`.

**Why:** Live health checks showed the root Express API is reachable but not connected to its database, while the API subdomain does not reach the app. The user's production data remains in Supabase.

**How to apply:** Configure the private Supabase PostgreSQL `DATABASE_URL` in the existing root-domain Hostinger Express app, not just `SUPABASE_URL`/anon key. Keep the frontend on `/api` at `oglandmark.com`; do not import MySQL over Supabase. Keep database credentials out of browser code, ZIPs, Git, and chat.