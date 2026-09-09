---
name: Location flow testing
description: Keep native GPS recovery logic testable without Expo or a physical device
---

Native location permission, service, timeout, and fallback behavior should live behind a small provider interface so deterministic tests can supply fake Expo responses and reverse-geocoding results.

**Why:** Expo and React Native runtime imports are not available in the Node test runner, while GPS recovery branches are too important to leave to device-only checks.

**How to apply:** Keep the production adapter responsible for native alerts and settings links, and test the provider-independent flow plus listing payload transformation with short timeout values and mocked location data.