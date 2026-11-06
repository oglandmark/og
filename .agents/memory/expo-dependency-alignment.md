---
name: Expo dependency alignment
description: Distinguishing transient Metro resolution errors from dependency installation restarts.
---

Expo SDK dependency alignment can invoke multiple package-install steps. The managed mobile workflow may restart between those steps and briefly report that a declared module cannot be resolved. After all installs finish, verify that the module resolves and that a final web bundle succeeds before treating the intermediate error as persistent.

If `expo install --fix` is blocked because a compatible SDK patch is too newly published for Replit's package firewall, do not bypass the firewall or install an incompatible major version. Confirm the package files were not partially changed and retry after the version clears the release-age rule.

**Why:** Replit restarts managed workflows after package installation, so Metro can start during an incomplete dependency transition and recover after the final install. The package firewall may also reject a newly released compatible patch even when Expo Doctor requires it.

**How to apply:** Complete the Expo fix when allowed, check module resolution, then inspect the latest workflow output and preview instead of stopping at an intermediate Metro error. If release age blocks the fix, preserve the current lockfile and report the exact blocked package/version.