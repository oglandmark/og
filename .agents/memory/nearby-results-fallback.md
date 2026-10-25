---
name: Mobile empty-response fallbacks
description: Keep offline and nearby-search fallbacks without resurrecting listings removed from the public catalogue.
---

When the public banner endpoint returns no valid active category image slides, keep the five bundled Home banner slides. A successful empty unfiltered property response is authoritative: Home must not restore demos after loading, and Explore must clear both cached live rows and bundled examples. Nearby/bounds searches can preserve the cache for local geographic filtering; request failures may keep offline content.

**Why:** Admin deletions remove records from the API, but a client that treats every successful empty response as an outage can bring those records back from cache or bundled fallbacks. Banner fallback and geographically filtered search still have separate legitimate empty-response needs.

**How to apply:** Distinguish loading/offline failure from a successful empty global catalogue response. Clear cached live rows on the latter, retain bundled samples only according to the current screen's fallback rules, and preserve cached rows for nearby/bounds filtering.