---
name: EAS cloud monorepo builds
description: Direct EAS CLI uploads can build without GitHub, but pnpm workspace install behavior depends on the remote builder's package-manager policy.
---

Direct `eas-cli build` uploads the workspace to EAS without requiring a GitHub connection and does not submit the result unless a submit step is explicitly requested. In this workspace, the remote EAS Android builder initially failed during dependency installation with `ERR_PNPM_IGNORED_BUILDS` for `esbuild@0.27.3`; pnpm 11 accepted the build after using `dangerouslyAllowAllBuilds: true` without a conflicting `onlyBuiltDependencies` list. The mobile package also needs an explicit Expo-SDK-matched `babel-preset-expo` dependency because the native bundle invokes the app's Babel config remotely.

Expo MCP builds read the GitHub repository linked to the Expo project, which can differ from Replit's local Git remote. Do not assume `gitRef: main` contains the current workspace; compare the build's `gitCommitHash` with the intended source and sync only required files through the Git Data API when they differ.

Do not assume the linked repository's main branch is newer than the latest successful EAS build.

**Why:** A successful APK snapshot can include newer app configuration and mobile fixes than main, as well as a builder-compatible lockfile absent from the local workspace.

**How to apply:** Compare main, the latest successful build commit, and the intended local mobile changes before choosing a rebuild base. For a targeted rebuild, preserve the verified dependency snapshot and apply only the intended changes on a dedicated build branch.

For every Google Play Android AAB, increment both `expo.version` and `android.versionCode` before building; do not reuse a code already used in Play Console.

**Why:** The Replit workspace and EAS's pnpm 11 builder do not initially apply the same build-script approval behavior, and a missing Babel preset only appears after the dependency phase succeeds. Preview profiles can also default to Node 18 and JDK 11 even when production pins newer runtimes; Metro's `toReversed` use needs Node 20, and Gradle needs Java 17. A successful dispatch can still target a stale linked GitHub repository. Play Console rejected a new bundle that reused versionCode 21 even though the user had asked for a version upgrade.

**How to apply:** Before a Google Play AAB build, set `expo.version` and `android.versionCode` above the most recently used Play Console version, then verify both in EAS build metadata. Check the EAS install-dependencies, bundle, and Gradle logs in order. Pin Android preview profiles to Node 20 and a JDK 17 build image. Keep the pnpm build-script policy valid for the chosen pnpm version, ensure the mobile package declares `babel-preset-expo`, and do not submit the finished artifact unless explicitly requested. For GitHub-based builds, compare feature files in the workspace with their contents at the exact remote commit—not just whether paths exist—then verify imports and Expo-config assets. A stale remote file can compile while silently omitting a UI or route fix.