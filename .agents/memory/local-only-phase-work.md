---
name: Local-only phase work
description: Environment boundary for the ongoing OG Landmark integration phases.
---

For the 12-phase OG Landmark integration, keep source changes and verification local; do not deploy to or update production, including production records, unless the user explicitly changes this instruction. Keep the Expo Preview mobile client's shared API base on the live API so existing accounts and the full property catalogue remain available. Do not globally switch the app to the Replit SQLite API, which has partial catalogue data and separate auth throttles.

For local property management, a read-only public catalogue snapshot may be imported into Replit's local store so the Admin dashboard and preview app share one catalogue. Admin and Mobile preview edits must remain local; never send them to production.

**Why:** The user reported missing properties and “Too Many Attempts” after the Expo Preview was routed to the local SQLite API.

**How to apply:** Test local Laravel changes through isolated feature tests. Preserve the mobile preview's existing account/inventory API behavior, and do not submit production test writes or deploy backend changes without explicit permission.

When an Admin permanently deletes a locally mirrored property, retain its ID in local deletion tombstones and make every later preview mirror sync skip it.

**Why:** The local preview periodically imports public properties; a removed listing can otherwise return when the mirror's imported-ID cache does not contain it.

**How to apply:** Write the tombstone in the same local catalogue mutation that removes the property, then verify both the Admin list and public Mobile feed remain clear after a stale mirror sync.
