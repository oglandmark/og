---
name: Production API runtime
description: Current production API host and health-reported storage provider; recheck before changing either.
---

Read-only checks on 2026-11-10 showed that `https://api.oglandmark.com/api/health` returns JSON with status `ok`, database connected, provider `mysql`, and API `og-landmark-laravel`. Unauthenticated GET requests to `/api/inquiries` and `/api/appointments` return JSON 401 responses. The root website domain's `/api/*` paths return HTML, not API JSON.

**Why:** These live responses contradict the earlier record that the API lived on the root domain and the API subdomain served a website; that record is stale.

**How to apply:** Keep mobile API requests on `api.oglandmark.com`; do not route them to the root website domain. Recheck health before data-store or deployment changes, and never use production write requests as tests.