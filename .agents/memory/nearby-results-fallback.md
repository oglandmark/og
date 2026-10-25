---
name: Mobile empty-response fallbacks
description: Keep offline and nearby-search fallbacks without resurrecting listings removed from the public catalogue.
---

When the public banner endpoint returns no valid active category image slides, keep the five bundled Home banner slides. Successful property feeds must show API listings only; bundled property demos are an offline/loading fallback, not extra live inventory. A successful empty unfiltered property response is authoritative: Home must not restore demos after loading, and Explore must clear cached live rows and bundled examples. Nearby/bounds searches can preserve cached live rows for local geographic filtering; request failures may keep offline content.

**Why:** The user expects the mobile preview's live property inventory to agree with the website and Admin; app-bundled examples must not inflate successful live feeds. Admin deletions also remove records from the API, but a client that treats every successful empty response as an outage can bring them back from cache or bundled fallbacks.

**How to apply:** Distinguish loading/offline failure from successful global or filtered responses. Use API results as the entire catalogue whenever a request succeeds with records; clear the global catalogue on a successful empty response. Keep bundled samples only as Home's loading/offline fallback, and preserve only cached live rows for nearby/bounds filtering.