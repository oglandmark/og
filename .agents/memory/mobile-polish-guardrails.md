---
name: Mobile polish guardrails
description: Durable UI rules for extending the OG Landmark Expo app without changing its product identity or creating invalid web markup.
---

Use the shared semantic tokens and reusable controls for new mobile UI, while preserving the current navy/gold identity, user-supplied OG house mark, and navigation. Use a transparent symbol-only logo without the LANDMARK wordmark for app icons, splash screens, and compact headers; use the white inverse mark on navy surfaces and the navy mark on light surfaces. Interactive property cards must keep their image, favorite, share, and media controls outside the body detail press target; do not nest pressable controls inside another pressable.

**Why:** The user asked to replace the mobile app's deep-green brand with navy and recolor its active logo/icon assets. The app is also rendered on web through React Native Web, where nested pressables become nested HTML buttons and produce hydration/runtime errors. Central tokens keep the visual language consistent across the many legacy screens.

**How to apply:** Extend `PolishedUI` and the semantic color/layout tokens before adding one-off controls. For cards, make the body the detail target and leave media/action controls as sibling press targets. Respect reduced-motion settings in shared animations.