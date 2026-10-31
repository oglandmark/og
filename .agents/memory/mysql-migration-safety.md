---
name: MySQL migration safety
description: Rules for completing the OG Landmark PostgreSQL-to-MySQL cutover without data loss.
---

This guidance is historical for a future MySQL transfer only. The user now confirms Supabase PostgreSQL is the current production database; do not treat Hostinger MySQL as the current source or try to restore it over Supabase.

**Why:** The user corrected the provider state while diagnosing production auth failures. Earlier migration notes predate the current Supabase setup.

**How to apply:** If MySQL is ever used again, follow this file's original backup and parity requirements. For current recovery, preserve Supabase and configure the replacement API with its private server-side PostgreSQL URL; verify the live API before testing auth.