---
name: EAS pnpm 8 lockfile compatibility
description: EAS Android builds in this workspace use pnpm 8.9.2 and require its legacy-compatible lockfile format.
---

EAS ignores the root package-manager version pin in this monorepo and currently installs with pnpm 8.9.2. Pnpm 8.9.2 cannot consume pnpm 9/10 lockfiles or the `catalog:` dependency protocol.

**Why:** Production Android builds failed before Gradle because the pnpm 10 lockfile was reported as incompatible, and pnpm 8 could not resolve catalog references.

**How to apply:** For EAS build commits, materialize catalog versions in package manifests and use a pnpm 8.9.2 lockfile with `lockfileVersion: "6.0"` and inline importer entries (`specifier` plus `version`). Keep unrelated attached screenshot assets out of Git data-API publish trees.