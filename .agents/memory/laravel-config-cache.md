---
name: Laravel config cache smoke checks
description: Laravel endpoint smoke tests must clear stale config before overriding database settings locally.
---

Laravel's non-production health check can report a connected database after `SELECT 1` succeeds even when `JsonStore` is reading a different connection and falling back to an empty document.

**Why:** A cached `DB_URL` can outlive shell overrides, so health and import commands may appear successful while listing reads use the wrong database.

**How to apply:** Clear config before local connection overrides, then verify both `app_data` parity and a real listing response; production config must be cached only after the final MySQL values are installed.

For isolated SQLite HTTP smoke tests in this workspace, start the Laravel front controller with PHP's built-in server after exporting the fixture database settings; the `artisan serve` child did not read the seeded fixture in the same check.

**Why:** The direct built-in server returned the seeded fixture login and listing data, while `artisan serve` returned invalid credentials against that fixture despite successful feature tests.

**How to apply:** Use a fresh temporary SQLite file, migrate and seed it explicitly, launch `php -S ... -t public public/index.php`, and confirm a fixture login or listing before routing the website proxy to it.