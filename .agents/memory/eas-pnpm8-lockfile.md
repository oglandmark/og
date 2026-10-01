---
name: EAS pnpm 8 lockfile compatibility
description: EAS Android builds in this workspace use pnpm 8.9.2 and require its legacy-compatible lockfile format.
---

EAS ignores the root package-manager version pin in this monorepo and currently installs with pnpm 8.9.2. Pnpm 8.9.2 cannot consume pnpm 9/10 lockfiles or the `catalog:` dependency protocol.

**Why:** Production Android builds failed before Gradle because the pnpm 10 lockfile was reported as incompatible; a later frozen install also exposed a missing dependency snapshot that only the builder-compatible pnpm 8 repair resolved. A subsequent retry showed the local workspace's database manifest differed from the exact GitHub commit EAS built, so a lockfile validated only against local manifests can still fail remotely.

**How to apply:** For EAS build commits, verify workspace manifests against the exact GitHub commit being built before regenerating a pnpm 8.9.2 lockfile (`lockfileVersion: "6.0"`, inline importer entries) and running a frozen install. Do not treat local success as proof when local and remote manifests differ. When regenerating beside active pnpm 10 `node_modules`, point pnpm 8 at a separate modules directory so it does not prompt to purge workspace installs. Review resolved mobile patch versions because regenerating an incompatible lockfile re-resolves allowed ranges. Keep unrelated attached screenshot assets out of Git data-API publish trees.