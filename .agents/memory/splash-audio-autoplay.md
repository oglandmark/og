---
name: Startup splash audio
description: How the OG Landmark startup animation handles automatic intro sound across native and web.
---

The startup splash should attempt to play its intro automatically and must not require a tap to continue the animation. Native playback can set the audio mode to play in silent mode. Web playback should be attempted, but browser autoplay policies can still block sound until the user has interacted with the page; do not claim guaranteed sound on every browser or let that restriction block startup.

For exact splash updates, treat the supplied HTML as the canonical animation and render it in the native WebView and web iframe rather than approximating its timing in React Native. Keep the splash-specific adapter guarded against changes to the source controls; it removes Replay/Sound controls and enables autoplay.

**Why:** The user requested automatic splash sound without a tap, while browser autoplay rules are outside the app's control.

**How to apply:** Preserve the supplied animation and embedded intro sound, keep native autoplay enabled, and make any web autoplay failure silent and non-blocking.
