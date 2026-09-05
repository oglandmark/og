---
name: Hostinger startup timeout
description: External Node hosting health checks can time out while a server waits for MySQL initialization.
---

The HTTP server must bind the assigned port before attempting MySQL initialization. Database setup should run in the background with a bounded connection timeout, while health and database-backed routes expose readiness explicitly.

**Why:** Hostinger can report a 503 after a long loading period when the Node process blocks on or retries an unreachable database before opening its port.

**How to apply:** For this deployment, verify `/api/health` after restart: `status: "ok"` and `database: "connected"` confirms production readiness; `status: "degraded"` means the app is reachable but the Hostinger database settings or permissions still need correction.