---
name: EAS pnpm and lockfile compatibility
description: Align the lockfile format with the explicit package-manager version in the target EAS build profile.
---

EAS build contexts can use different pnpm versions. The `pnpm` setting on a specific `eas.json` build profile is an explicit supported override; do not confuse it with the root `packageManager` field, which a builder may ignore. In this workspace, a production profile pinned to pnpm 10.26.1 accepted the v9 lockfile with a frozen install, while pnpm 10 rejected a v6 lockfile with `ERR_PNPM_LOCKFILE_BREAKING_CHANGE`. Earlier EAS contexts used pnpm 8.9.2 and required a v6 lockfile. These lockfile majors are not interchangeable.

**Why:** Production Android builds have failed before Gradle when the builder's pnpm major did not match the lockfile. Root-level package-manager metadata, explicit profile configuration, and historical builder logs are not equivalent signals.

**How to apply:** Read the exact build profile's `pnpm` setting first. Validate the lockfile with that pnpm version and the same workspace manifests and `.easignore` archive shape EAS will use. If the profile does not pin pnpm, verify the actual builder policy rather than inferring it from the root `packageManager` field or an older build.