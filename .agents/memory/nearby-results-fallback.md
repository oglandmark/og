---
name: Mobile empty-response fallbacks
description: Mobile Home banners and nearby catalogues should retain local or cached content when remote responses are empty.
---

When the public banner endpoint returns no valid active category image slides, keep the five bundled Home banner slides instead of replacing them with an empty list. Nearby filtering must also preserve its existing mobile property cache when a remote page is empty, so client-side radius filtering remains usable.

**Why:** Older or deployed banner APIs can return a successful but empty response while the app already has usable bundled banners. Clearing local content then makes the Home banner disappear after the first render. Nearby requests can also legitimately return no rows, and clearing their cache makes a valid GPS lookup look broken.

**How to apply:** Replace mobile fallbacks only with usable remote content. If product behavior later needs an intentional “hide all banners” action, add an explicit signal rather than interpreting an empty array as that command. For nearby search, keep exact-distance filtering before server-side pagination.