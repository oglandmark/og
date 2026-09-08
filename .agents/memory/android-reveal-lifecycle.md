---
name: Android reveal lifecycle
description: Prevent invisible content when nested animated children miss navigation focus events.
---

Animated content nested inside a tab screen should have a visible initial state. A navigation focus callback may not reach every nested child during Android startup or tab restoration, so an opacity-zero fallback can leave the screen laid out but blank.

**Why:** The Home screen showed its header and video while all post-banner sections remained invisible after install or returning from another tab.

**How to apply:** Keep reveal animations progressive, but initialize their shared visibility value to the visible state and let focus callbacks optimize the transition rather than being required for content visibility.