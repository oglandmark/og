---
name: Native splash provider order
description: Native-only startup UI can expose provider-order errors that web previews never render.
---

Any native-only startup overlay that uses localized text or context-backed hooks must be rendered inside the corresponding provider hierarchy, not as a sibling outside it.

**Why:** The Android-only opening splash once rendered outside the language provider, causing the production app to show its root error fallback while web preview remained healthy because the splash was not mounted there.

**How to apply:** When changing RootLayout or startup overlays, inspect every hook used by the overlay and place it below those providers. Validate an Android export/build rather than relying only on web preview.