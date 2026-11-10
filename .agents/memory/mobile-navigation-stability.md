---
name: Mobile navigation stability
description: Keep Android screen changes immediate and prevent blank transition frames.
---

On Android, prefer no route or tab transition animation and keep the navigator's content background opaque; iOS may retain its existing transitions. Keep the bottom navigation visible during scrolling in both directions. Do not route account-owned My Properties links through a role-hidden tab; use a top-level route and allowlist it in the root startup guard.

**Why:** The user reported blank flashes between pages and wants the app to feel fast. They also explicitly asked that scrolling not make the bottom navigation disappear. A public User account confirmed that internal navigation to its role-hidden Listings tab fell back to Home; a separate top-level route fixed it on iPhone.

**How to apply:** When adjusting Expo Router navigation, avoid Android fade/slide transitions, preserve a theme-colored screen background, and do not hide the bottom bar from scroll handlers. If a screen is hidden from tabs by role, ensure internal links use an independently reachable route that is included in the root layout's startup-route allowlist.
