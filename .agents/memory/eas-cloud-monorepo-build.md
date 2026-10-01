---
name: EAS cloud monorepo builds
description: Direct EAS CLI uploads can build without GitHub, but pnpm workspace install behavior depends on the remote builder's package-manager policy.
---

Direct `eas-cli build` uploads the workspace to EAS without requiring a GitHub connection and does not submit the result unless a submit step is explicitly requested. In this workspace, the remote EAS Android builder initially failed during dependency installation with `ERR_PNPM_IGNORED_BUILDS` for `esbuild@0.27.3`; pnpm 11 accepted the build after using `dangerouslyAllowAllBuilds: true` without a conflicting `onlyBuiltDependencies` list. The mobile package also needs an explicit Expo-SDK-matched `babel-preset-expo` dependency because the native bundle invokes the app's Babel config remotely.

**Why:** The Replit workspace and EAS's pnpm 11 builder do not initially apply the same build-script approval behavior, and a missing Babel preset only appears after the dependency phase succeeds. Preview profiles can also default to Node 18 and JDK 11 even when production pins newer runtimes; Metro's `toReversed` use needs Node 20, and Gradle needs Java 17.

**How to apply:** When generating a future Android bundle, check the EAS install-dependencies, bundle, and Gradle logs in order. Pin Android preview profiles to Node 20 and a JDK 17 build image. Keep the pnpm build-script policy valid for the chosen pnpm version, ensure the mobile package declares `babel-preset-expo`, and do not submit the finished artifact unless explicitly requested. For GitHub-based builds, verify every locally imported source file exists in the remote commit tree; local typecheck can pass while the cloud bundle fails on a file that was not published.