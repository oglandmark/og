---
name: Mobile polish guardrails
description: Durable UI rules for extending the OG Landmark Expo app without changing its product identity or creating invalid web markup.
---

Use the shared semantic tokens and reusable controls for new mobile UI, while preserving the current navy/gold identity, the existing dark-green roof/house + OG mark, and navigation. Do not use the newest uploaded navy logo or the former three-pillar mark. Use a transparent symbol-only logo without the LANDMARK wordmark for app icons and compact headers; show the symbol alone on native splash and app-opening loading screens, with no separate brand-name line beneath it. Use the white inverse mark on navy surfaces and the dark-green mark on light surfaces. Interactive property cards must keep their image, favorite, share, and media controls outside the body detail press target; do not nest pressable controls inside another pressable.

**Why:** On October 3, 2026, the user corrected the logo selection: the existing roof/house + OG artwork is authoritative, the newest uploaded logo is not the intended asset, and the three-pillar mark must be removed throughout the app. The Expo Go loading view's label is the configured project name, not the in-app splash; changing it also changes the installed app's display name. The app is also rendered on web through React Native Web, where nested pressables become nested HTML buttons and produce hydration/runtime errors. Central tokens keep the visual language consistent across the many legacy screens.

**How to apply:** Extend `PolishedUI` and the semantic color/layout tokens before adding one-off controls. Use the existing roof/house + OG mark and its white inverse on dark surfaces. Keep the three-pillar artwork out of active app, web, portal, legal-page, icon, and splash assets. For cards, make the body the detail target and leave media/action controls as sibling press targets. Respect reduced-motion settings in shared animations.

Native status-bar icons do not support an arbitrary brand tint on iOS or Android; use the OS dark-content mode on a light status-bar area, and preserve intentional hiding in immersive full-screen media.

**Why:** The user requested navy system icons, but native status-bar APIs expose dark/light treatments rather than an exact custom icon color. Dark icons need a light area behind them to remain legible.

**How to apply:** Set the shared Expo status bar to dark content and Android's native status-bar style to `dark-content`. Do not draw substitute battery, signal, or time icons.