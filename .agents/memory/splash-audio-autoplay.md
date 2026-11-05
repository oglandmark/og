---
name: Silent startup splash
description: Keep the OG Landmark startup animation silent without muting unrelated app audio.
---

The startup splash animation must remain silent on native and web. Remove embedded splash audio and prevent autoplay, but preserve unrelated app audio such as listing videos.

For splash updates, preserve the supplied HTML animation and render it in the native WebView and web iframe rather than approximating its timing in React Native.

**Why:** The user requested that sound be removed from the splash page.

**How to apply:** Keep future splash changes silent; do not remove the app-wide audio configuration needed for video playback.
