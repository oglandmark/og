#!/usr/bin/env bash
set -Eeuo pipefail

# Post-merge runs without an interactive stdin. Keep dependency setup
# resilient to harmless workspace manifest/catalog drift and transient pnpm
# process aborts observed in this environment.
install_attempt=1
while true; do
  if pnpm install --no-frozen-lockfile --prefer-offline --reporter=append-only; then
    break
  else
    install_status=$?
  fi

  # pnpm has once terminated with SIGABRT (134) and succeeded on immediate
  # retry. Retry that process-level abort only; surface all other failures.
  if [[ "$install_status" -ne 134 || "$install_attempt" -ge 3 ]]; then
    exit "$install_status"
  fi

  install_attempt=$((install_attempt + 1))
  echo "pnpm aborted with exit 134; retrying dependency install (${install_attempt}/3)." >&2
  sleep 2
done

# The OG Landmark backend uses its own Neon app_data schema. Only run the
# shared Drizzle push when this environment explicitly has a database URL.
if [[ -n "${DATABASE_URL:-}" ]]; then
  pnpm --filter @workspace/db run push-force
else
  echo "DATABASE_URL is not configured; skipping Drizzle schema push."
fi
