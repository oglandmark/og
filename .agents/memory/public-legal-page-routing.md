---
name: Public legal-page SPA routing
description: Ensure homepage links reach standalone policy and account-deletion pages from both direct loads and client-side navigation.
---

When the public homepage SPA links to standalone legal HTML pages, server routes and an initial-load redirect are not enough. SPA navigation through `history.pushState` or `replaceState` does not request the server or rerun the initial guard; handle those history changes and back/forward navigation while preserving any artifact path prefix.

**Why:** A homepage policy link remained on the SPA not-found page even though direct requests to the standalone policy URL returned the page successfully.

**How to apply:** For public legal pages, verify direct URL loads and simulate homepage client-side navigation (`pushState`/`replaceState`) as separate cases.