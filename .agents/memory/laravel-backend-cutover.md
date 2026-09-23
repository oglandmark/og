---
name: Laravel backend cutover
description: Shared Laravel API preserves the existing OG Landmark app_data JSON contract during the Node-to-Laravel transition.
---

The Laravel API should keep the existing `/api/*` response shapes and reuse `app_data`, `auth_sessions`, and `auth_challenges` before any destructive relational rewrite.

**Why:** The website and Expo client already depend on the legacy route names, mixed numeric/string IDs, and the canonical MySQL JSON document. A compatibility cutover lowers production migration risk.

**How to apply:** Keep clients unchanged while verifying Laravel parity. Only switch the public domain after production routing, SMTP, media storage, and endpoint parity are verified.