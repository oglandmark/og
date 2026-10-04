---
name: Expo dependency alignment
description: Distinguishing transient Metro resolution errors from dependency installation restarts.
---

Expo SDK dependency alignment can invoke multiple package-install steps. The managed mobile workflow may restart between those steps and briefly report that a declared module cannot be resolved. After all installs finish, verify that the module resolves and that a final web bundle succeeds before treating the intermediate error as persistent.

**Why:** Replit restarts managed workflows after package installation, so Metro can start during an incomplete dependency transition and recover after the final install.

**How to apply:** Complete the Expo fix, check module resolution, then inspect the latest workflow output and preview instead of stopping at an intermediate Metro error.