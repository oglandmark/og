#!/usr/bin/env bash
set -Eeuo pipefail

# Post-merge runs without an interactive stdin. Keep dependency setup
# resilient to harmless workspace manifest/catalog drift.
pnpm install --no-frozen-lockfile --prefer-offline --reporter=append-only

# The OG Landmark backend uses its own Neon app_data schema. Only run the
# shared Drizzle push when this environment explicitly has a database URL.
if [[ -n "${DATABASE_URL:-}" ]]; then
  pnpm --filter @workspace/db run push-force
else
  echo "DATABASE_URL is not configured; skipping Drizzle schema push."
fi
