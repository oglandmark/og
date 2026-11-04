---
name: Local auth test fixtures
description: Password format required by isolated OG Landmark JSON-fallback server tests
---

Local JSON-fallback server fixtures must seed passwords as `pbkdf2:<salt>:<hex hash>` values compatible with the server's PBKDF2 verifier; plain-text fixture passwords are not migrated in that path. Isolated Admin tests must also clear inherited local Admin credential overrides so startup does not replace the seeded password.

**Why:** Isolated integration tests use the local fallback instead of Neon, login reads fixture hashes directly, and inherited Admin overrides can replace the fixture password during startup.

**How to apply:** Generate fixture hashes with PBKDF2-SHA512 using 100,000 iterations and a deterministic test-only salt; clear Admin override variables in spawned test environments; never use production credentials in fixtures.