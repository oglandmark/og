---
name: User-controlled mobile builds
description: The user controls when a new mobile application build is started.
---

Do not start a new mobile app build until the user explicitly authorizes it.

For OG Landmark iOS preparation, do not start a paid iOS build or paid simulator session; the user explicitly does not want paid iOS build or simulator testing.

**Why:** the user asked to approve each new build.

**How to apply:** Code changes, tests, typechecks, and preview checks may continue. Do not trigger an Android/AAB/Expo production build or Play Store submission without explicit approval, and do not use paid iOS build or simulator testing for this preparation.
