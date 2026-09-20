---
name: MySQL projection parity
description: Durable guidance for keeping the indexed property projection safe across the main app and Hostinger export.
---

Keep every rebuildable MySQL projection aligned across its table schema, numbered migration, runtime upsert statement, typed schema, and any independently deployable export. Prefer bounded batch upserts over sequential writes, and validate that the number of SQL placeholders equals the bound values before deployment.

**Why:** The Hostinger export is maintained as a separate deployable copy, and a column/value mismatch can remain invisible in local JSON-preview mode while failing only during live MySQL startup synchronization.

**How to apply:** Whenever projection columns or media metadata change, compare the main and export copies, run syntax checks, and exercise the live-MySQL path or a representative SQL binding test before declaring the migration complete.