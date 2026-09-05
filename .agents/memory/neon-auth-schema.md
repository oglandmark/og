---
name: Neon auth schema
description: Production authentication depends on the auxiliary Neon tables in addition to the main JSON document table.
---

The production Neon database must contain `app_data`, `auth_sessions`, and `auth_challenges`; having only `app_data` makes health checks pass while real login, registration, and password-reset requests fail.

**Why:** The health endpoint only verifies database connectivity and the main data row, while auth persistence uses separate tables. A partially initialized database therefore fails late with missing-relation errors.

**How to apply:** Keep the schema in `database/schema.sql`, and ensure production startup creates all three tables idempotently before marking the database ready.