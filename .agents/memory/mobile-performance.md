---
name: Mobile performance budget
description: Guardrails for public-feed refreshes, large Home carousels, and local search state.
---

Avoid short background polling for public Home and Explore feeds. Refresh on screen focus and app resume, with a modest interval while visible. Avoid JS timer-driven carousel motion when users can swipe, cap heavy horizontal card collections, and keep typing in search fields out of large parent renders. For the startup splash, keep logo paths static, animate their container, cache SVG element lookups, and do not rewrite static particle attributes every frame.

**Why:** The user identified OG Landmark Mobile as slow; frequent feed requests, a continuous JS scroll loop, rendering every candidate card, and repeated SVG DOM work caused avoidable load. The user confirmed caching lookups and keeping particle radius static removed a mid-splash pause on Android.

**How to apply:** Prefer immediate focus/resume refresh plus a 60-second visible interval for public feeds. Treat successful empty responses as valid results instead of retrying them as network failures. Use UI-thread transforms for splash motion, keep SVG per-frame work minimal, and verify smoothness on a real Android device.
