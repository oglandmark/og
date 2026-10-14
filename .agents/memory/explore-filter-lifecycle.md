---
name: Explore filter lifecycle
description: Explore filters should be temporary and not survive leaving or reloading the page.
---

Treat Explore filters and project mode as session-only state. When users leave Explore, returning later or reloading should show all properties with no prior filter selected.

**Why:** The user expects an unfiltered Explore page whenever they return, even if they previously chose Projects or another filter.

**How to apply:** Clear active filters on route blur, consume and remove any one-time incoming filter parameters, and reset pagination and map/search state together.
