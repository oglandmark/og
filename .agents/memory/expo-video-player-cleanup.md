---
name: Expo video player cleanup
description: Prevent errors caused by pausing a native video player after its hook has released it.
---

Do not call `player.pause()` in an effect cleanup for a player created by `useVideoPlayer`; rely on the hook's release lifecycle and cancel pending asynchronous play work.

**Why:** The native shared object can be disposed before cleanup calls `pause()`, producing “Unable to find the native shared object” and causing the Home tab's error boundary to trip.

**How to apply:** When a component unmounts a video player, cancel pending async callbacks and let `useVideoPlayer` release the player. For explicit player lifetimes, verify the player is still valid before invoking native methods, and keep cleanup non-throwing.
