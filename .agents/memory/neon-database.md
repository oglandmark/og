---
name: Production database runtime parity
description: Reconcile the earlier Neon decision with the live API and preview database providers.
---

The project previously recorded a decision to use Neon PostgreSQL. During the 2026-10-29 audit, the public `www.oglandmark.com/api/health` endpoint reported `databaseProvider=mysql`, while the Replit Laravel preview reported `sqlite`. Treat these as separate runtimes and do not assume the earlier Neon note describes the currently serving API.

**Why:** The live health response contradicts the earlier provider note, and the local preview uses a separate database; provider assumptions can hide cross-environment data divergence.

**How to apply:** Verify each runtime independently with its health endpoint before diagnosing sync or planning migrations. Do not query or mutate external production data without an approved access path, and never expose connection secrets.