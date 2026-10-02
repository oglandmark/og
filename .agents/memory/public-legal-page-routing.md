---
name: Public legal-page SPA routing
description: Ensure homepage links reach standalone policy and account-deletion pages from both direct loads and client-side navigation.
---

When the public homepage SPA links to standalone legal HTML pages, server routes and an initial-load redirect are not enough. Handle history changes and back/forward navigation; also inspect the rendered anchor itself. A compiled link with `href="#"` needs its destination repaired and its click intercepted before React's delegated handler.

**Why:** Direct policy URLs can work while a compiled footer link still points to `#`; a separate deletion URL can also fall through to a blank SPA page.

**How to apply:** Check the rendered `href` and direct HTTP response separately. Verify direct loads, client-side navigation, and back/forward behavior; repair placeholder links and keep server routes, redirects, and any artifact path prefix aligned.