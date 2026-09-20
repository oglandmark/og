---
name: MySQL migration safety
description: Rules for completing the OG Landmark PostgreSQL-to-MySQL cutover without data loss.
---

The Hostinger cutover is incomplete until a verified live source snapshot has been compared with the MySQL target; repository seed JSON is not evidence of production parity.

**Why:** The application stores its canonical state as one JSON document, so a successful schema migration alone cannot prove that users, listings, sessions, and challenges were preserved.

**How to apply:** Configure the server-only MySQL URL, run the non-destructive migration, import only into an empty target using the refusal-to-overwrite script, then compare source/target checksums and verify the connected MySQL health response.