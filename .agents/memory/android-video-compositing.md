---
name: Android video compositing
description: Android Expo video surfaces can interfere with sibling React Native content in stacked or animated layouts.
---

For native homepage banners, use Expo VideoView with `textureView` on Android and do not mount inactive video slides. Keep inactive slides as empty animated containers until they become active.

**Why:** Android `SurfaceView` instances can create z-order/compositing problems inside animated absolute-positioned layouts, making the surrounding scroll content appear white or blank while the active video remains visible.

**How to apply:** When adding or changing Expo video banners in React Native, preserve active-only VideoView mounting and the Android texture-surface configuration; verify the production-like Android flow rather than relying only on web preview.