---
name: Post-merge setup
description: Workspace-specific constraints for the automatic post-merge dependency and database setup.
---

The automatic post-merge setup must tolerate pnpm catalog/manifest drift, use the scoped database package name, and remain non-interactive.

**Why:** The workspace lockfile can lag a package manifest's catalog specifier, and the database package is named `@workspace/db`; a frozen install or unscoped `db` filter causes an unattended merge setup to fail.

**How to apply:** Use a non-frozen pnpm install, run the scoped Drizzle package only when `DATABASE_URL` is available, and allow enough timeout for schema inspection.