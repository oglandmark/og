---
name: User-controlled mobile builds
description: The user controls when a new mobile application build is started.
---

Do not start a new mobile app build until the user explicitly authorizes it.

**Why:** the user asked to approve each new build.

**How to apply:** Code changes, tests, typechecks, and preview checks may continue, but do not trigger an Android/AAB/Expo production build or Play Store submission without explicit approval.
