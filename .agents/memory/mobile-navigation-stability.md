---
name: Mobile navigation stability
description: Keep Android screen changes immediate and prevent blank transition frames.
---

On Android, prefer no route or tab transition animation and keep the navigator's content background opaque; iOS may retain its existing transitions. Keep the bottom navigation visible during scrolling in both directions.

**Why:** The user reported blank flashes between pages and wants the app to feel fast. They also explicitly asked that scrolling not make the bottom navigation disappear.

**How to apply:** When adjusting Expo Router navigation, avoid Android fade/slide transitions, preserve a theme-colored screen background, and do not hide the bottom bar from scroll handlers.
