---
name: Expo web image preview
description: Local hero images in the Expo web preview need reliable absolute-fill rendering and a readable overlay.
---

Use `expo-image` with an absolute-fill image layer for prominent local media in Expo screens, then place the gradient and text content in sibling layers. This keeps the asset visible in the proxied web preview while preserving native rendering.

**Why:** The onboarding hero rendered as an almost-solid dark panel when it used `ImageBackground`; the same asset became visible and readable after switching to the explicit image layer.

**How to apply:** Prefer this layering pattern for onboarding and other full-bleed local hero media; keep the overlay semantic-token based and avoid making the image rely on the background component's child layout.