---
name: EAS iOS internal builds
description: Requirements for non-interactive EAS internal iOS builds in this workspace.
---

For an internal iOS build, configure Expo's remote credentials before starting the non-interactive build: a distribution certificate plus an Ad Hoc provisioning profile that includes the app identifier, intended device UDIDs, and any entitlements the app requests. A certificate alone is not enough. An APNs key is separate from the provisioning profile's Push Notifications capability; the key can be omitted for signing, but push delivery will not be configured.

Pin the build image to a currently supported Xcode version compatible with the React Native native project. Do not assume the EAS runner's default Xcode is new enough; inspect the Install Pods/Xcode log when CocoaPods reports a minimum-version requirement.

**Why:** The Expo build callback runs non-interactively, so it cannot stop for Apple login or create missing credentials, and its default runner image may lag behind the project's React Native requirement.

**How to apply:** Complete credentials setup in the Expo project first, register the test devices, ensure the Ad Hoc profile carries required capabilities, and select a compatible EAS image before retrying. Keep App Store submission disabled for internal IPA requests.
