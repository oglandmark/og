---
name: Color-only native splash
description: Keep the native pre-JS splash logo-free while preserving Android resource linking.
---

Keep the native pre-JavaScript splash color-only; show the OG Landmark logo only on the animated in-app splash. The user explicitly wants no logo before that animation.

Expo SDK 57's Android splash styling references `@drawable/splashscreen_logo` even when image fields are omitted, but then does not generate that drawable. Configure transparent vector drawables for both light and dark Android modes; do not add the brand logo to native splash image fields.

**Why:** The logo-free splash is a product requirement, and the missing Android drawable caused release resource linking to fail.

**How to apply:** When changing splash configuration or upgrading Expo, keep native image fields unset, verify transparent drawables are generated, and run an Android release build.
