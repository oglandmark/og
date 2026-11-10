---
name: iPad orientation configuration
description: Preserve Android and iPhone portrait behavior while enabling iPad multitasking orientations in Expo.
---

Set `ios.supportsTablet` to `true` while retaining the root portrait orientation when Android and iPhone must remain portrait-only. Expo SDK 57's iOS config plugin adds all four required iPad orientations and keeps multitasking enabled independently of the root orientation.

**Why:** Changing the root orientation to `default` also makes Android rotate, which violates the product requirement to preserve Android behavior.

**How to apply:** After changing tablet support, inspect the resolved iOS config and verify iPad orientation keys, iPhone portrait keys, and the Android manifest orientation separately.
