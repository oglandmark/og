---
name: Local auth test fixtures
description: Password format required by isolated OG Landmark JSON-fallback server tests
---

Local JSON-fallback server fixtures must seed passwords as `pbkdf2:<salt>:<hex hash>` values compatible with the server's PBKDF2 verifier; plain-text fixture passwords are not migrated in that path.

**Why:** Isolated integration tests use the local fallback instead of Neon, and login verification reads the stored value directly.

**How to apply:** Generate fixture hashes with PBKDF2-SHA512 using 100,000 iterations and a deterministic test-only salt; never use production credentials in fixtures.