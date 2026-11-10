---
name: Expo dependency alignment
description: Expo package alignment, Metro restarts, and stale pnpm links after SDK upgrades.
---

Expo SDK dependency alignment can invoke multiple package-install steps. The managed mobile workflow may restart between those steps and briefly report that a declared module cannot be resolved. After all installs finish, verify that the module resolves and that a final web bundle succeeds before treating the intermediate error as persistent.

If `expo install --fix` is blocked because a compatible SDK patch is too newly published for Replit's package firewall, do not bypass the firewall or install an incompatible major version. Confirm the package files were not partially changed and retry after the version clears the release-age rule.

After an SDK major upgrade in this pnpm workspace, Expo Doctor may report duplicate native modules from stale peer-context folders under the shared virtual store even when the app importer and lockfile resolve only the target SDK. A normal root `pnpm install` may leave those folders; a root `pnpm install --force` rebuilt the workspace and cleared the duplicate check.

**Why:** Replit restarts managed workflows after package installation, so Metro can start during an incomplete dependency transition and recover after the final install. pnpm's existing virtual store can also retain obsolete peer contexts that confuse Expo Doctor after a major SDK transition. The package firewall may reject a newly released compatible patch even when Expo Doctor requires it.

**How to apply:** Complete the Expo fix when allowed, confirm the app's importer and `pnpm why` no longer resolve the old SDK, then if Expo Doctor still sees old peer contexts run `pnpm install --force` from the workspace root and rerun Doctor. Check module resolution and the latest workflow output instead of stopping at an intermediate Metro error. If release age blocks the fix, preserve the current lockfile and report the exact blocked package/version.