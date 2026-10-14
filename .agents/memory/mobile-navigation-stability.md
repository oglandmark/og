---
name: Mobile navigation stability
description: Keep Android screen changes immediate and prevent blank transition frames.
---

On Android, prefer no route or tab transition animation and keep the navigator's content background opaque; iOS may retain its existing transitions.

**Why:** The user reported blank flashes between pages and wants the app to feel fast.

**How to apply:** When adjusting Expo Router navigation, avoid Android fade/slide transitions and preserve a theme-colored screen background behind route content.
