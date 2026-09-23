---
name: Laravel backend cutover
description: Shared Laravel API preserves the existing OG Landmark app_data JSON contract during the Node-to-Laravel transition.
---

The Laravel API should keep the existing `/api/*` response shapes and reuse `app_data`, `auth_sessions`, and `auth_challenges` before any destructive relational rewrite.

**Why:** The website and Expo client already depend on the legacy route names, mixed numeric/string IDs, and the canonical MySQL JSON document. A compatibility cutover lowers production migration risk.

**How to apply:** Keep clients unchanged while verifying Laravel parity. Only switch the public domain after production routing, SMTP, media storage, and endpoint parity are verified.

The public Node website can remain the asset host while an opt-in `LARAVEL_API_URL` proxy forwards its existing `/api/*` origin to Laravel; clearing that variable is the rollback switch.

**Why:** This avoids changing website and Expo route bases during the observation window and keeps a reversible traffic boundary between the two runtimes.

**How to apply:** Verify the Laravel API origin first, set the proxy only after MySQL/SMTP/media smoke checks pass, and do not silently fail over individual requests because split writes would make rollback unsafe.