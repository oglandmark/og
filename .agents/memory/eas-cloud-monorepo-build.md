---
name: EAS cloud monorepo builds
description: Direct EAS CLI uploads can build without GitHub, but pnpm workspace install behavior depends on the remote builder's package-manager policy.
---

Direct `eas-cli build` uploads the workspace to EAS without requiring a GitHub connection and does not submit the result unless a submit step is explicitly requested. In this workspace, the remote EAS Android builder currently fails during dependency installation with `ERR_PNPM_IGNORED_BUILDS` for `esbuild@0.27.3`, even though `onlyBuiltDependencies` includes `esbuild` in the workspace configuration.

**Why:** The Replit workspace and EAS's pnpm 11 builder do not currently apply the same build-script approval behavior, so retries alone do not resolve this failure.

**How to apply:** When generating a future Android bundle, check the EAS install-dependencies log first. Treat this specific `esbuild` failure as a builder/configuration compatibility issue rather than an app-code failure; avoid repeated cloud retries until the workspace is packaged as an isolated mobile project or the EAS pnpm policy changes.