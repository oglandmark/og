---
name: Android tab refresh rendering
description: Tested Android Expo Go behavior when native RefreshControl is attached to buyer tabs.
---

On the user's Android Expo Go preview, Home, Explore, Favorites, and My Properties rendered blank whenever their scroll view had a native `RefreshControl`. Removing the control made the page content visible; replacing the branded control with a plain native one did not help. The user confirmed all four pages rendered after the Android controls were omitted.

**Why:** This is a device-observed Expo Go rendering issue, not a missing-data or style-color issue; logs showed valid content data and nonzero layouts.

**How to apply:** Keep native pull-to-refresh off these Android buyer tabs unless a different implementation is verified on device. Preserve data freshness through tab focus and app-resume refresh. iOS pull-to-refresh is unaffected.
