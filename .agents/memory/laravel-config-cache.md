---
name: Laravel config and environment checks
description: Clear stale config before local database overrides, and preserve custom env values in Laravel's local PHP server.
---

Laravel's non-production health check can report a connected database after `SELECT 1` succeeds even when `JsonStore` is reading a different connection and falling back to an empty document.

**Why:** A cached `DB_URL` can outlive shell overrides, so health and import commands may appear successful while listing reads use the wrong database.

**How to apply:** Clear config before local connection overrides, then verify both `app_data` parity and a real listing response; production config must be cached only after the final MySQL values are installed.

For isolated SQLite HTTP smoke tests in this workspace, start the Laravel front controller with PHP's built-in server after exporting the fixture database settings; the `artisan serve` child did not read the seeded fixture in the same check.

**Why:** The direct built-in server returned the seeded fixture login and listing data, while `artisan serve` returned invalid credentials against that fixture despite successful feature tests.

**How to apply:** Use a fresh temporary SQLite file, migrate and seed it explicitly, launch `php -S ... -t public public/index.php`, and confirm a fixture login or listing before routing the website proxy to it.

The default `php artisan serve` auto-reload mode filters the child PHP server's environment to Laravel's passthrough allowlist, which drops custom Replit secrets. `php artisan serve --no-reload` passes the full environment to the local server process.

**Why:** A local Admin endpoint returned “credential not configured” even though the secret existed in the editor environment; the workflow's child server had filtered it out.

**How to apply:** For artifact-managed local Laravel workflows that depend on custom Replit env vars, use `--no-reload` and restart after secret changes. Keep the setting scoped to development; never hard-code secrets in artifact configuration.