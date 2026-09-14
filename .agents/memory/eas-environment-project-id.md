---
name: EAS environment project matching
description: EAS production environment variables are scoped to the Expo project ID, not merely the visible project name.
---

The Maps environment variable must be created in the exact EAS project referenced by the mobile app and build request. A variable with the same name in another similarly named Expo project is invisible to the build and causes `READ_APP_CONFIG` to report it as missing.

**Why:** The app build initially failed repeatedly because the variable was present in a different project ID; once it was added to the build's project, the production AAB completed successfully.

**How to apply:** Before retrying a missing-variable build, compare the dashboard's project ID with the build/app project ID. Do not change the app's project ID just to match a variable in the wrong project.