---
name: Color-only native splash
description: Keep the native pre-JS splash logo-free while preserving Android resource linking.
---

Keep the native pre-JavaScript splash color-only with the animation's dark navy background; show the OG Landmark logo only inside the animated in-app splash. Never show a separate logo-only interstitial.

Expo SDK 57's Android splash styling references `@drawable/splashscreen_logo` even when image fields are omitted, but then does not generate that drawable. Configure transparent vector drawables for both light and dark Android modes; do not add the brand logo to native splash image fields.

**Why:** The user wants the animation page to appear directly, and a matching navy launch surface avoids a white flash while its WebView loads. The logo-free splash is a product requirement; the missing Android drawable also caused release resource linking to fail.

**How to apply:** When changing splash configuration or upgrading Expo, keep native image fields unset, match light and dark splash backgrounds to the in-app animation, verify transparent drawables are generated, and run an Android release build only when the user authorizes it.
