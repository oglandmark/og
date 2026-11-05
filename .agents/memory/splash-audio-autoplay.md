---
name: Startup splash audio
description: How the OG Landmark startup animation handles automatic intro sound across native and web.
---

The startup splash should attempt to play its intro automatically and must not require a tap to continue the animation. Native playback can set the audio mode to play in silent mode. Web playback should be attempted, but browser autoplay policies can still block sound until the user has interacted with the page; do not claim guaranteed sound on every browser or let that restriction block startup.

**Why:** The user requested automatic splash sound without a tap, while browser autoplay rules are outside the app's control.

**How to apply:** Keep native auto-play enabled, use the current branded intro audio with the splash timing, and make any web autoplay failure silent and non-blocking.
