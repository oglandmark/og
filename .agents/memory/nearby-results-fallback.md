---
name: Mobile empty-response fallbacks
description: Keep offline and nearby-search fallbacks without resurrecting listings removed from the public catalogue.
---

When the public banner endpoint returns no valid active category image slides, keep the five bundled Home banner slides. Mobile public property screens show only Admin-approved, active API listings; never show bundled property demos, including during loading or offline states. A successful empty unfiltered property response clears the catalogue. Nearby/bounds searches can preserve cached approved live rows for local geographic filtering. Property detail routes reserve negative IDs for bundled demos; positive IDs always resolve from the live API, even when a number matches a bundled demo ID.

**Why:** The user explicitly requires mobile properties to be Admin-approved and asked to remove demo properties, so inventory accuracy takes precedence over demo fallback content. A live property ID collided with a bundled demo ID, causing Home to show the live listing while its detail route incorrectly blocked it as a demo.

**How to apply:** Filter public feed responses by approval and active listing status, reject bundled/demo records in every public list and detail route, start feeds empty until live data loads, and preserve only cached approved API rows for nearby/bounds filtering. Keep Admin demo-management controls separate. When resolving property details, never infer demo status from a colliding positive ID; fetch positive IDs from the API and use negative IDs for local demos.