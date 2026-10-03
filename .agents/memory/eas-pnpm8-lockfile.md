---
name: EAS pnpm 8 lockfile compatibility
description: EAS Android builds in this workspace use pnpm 8.9.2 and require its legacy-compatible lockfile format.
---

EAS ignores the root package-manager version pin in this monorepo and currently installs with pnpm 8.9.2. Pnpm 8.9.2 cannot consume pnpm 9/10 lockfiles or the `catalog:` dependency protocol.

**Why:** Production Android builds failed before Gradle because the pnpm 10 lockfile was reported as incompatible; a later frozen install also exposed a missing dependency snapshot that only the builder-compatible pnpm 8 repair resolved. A subsequent retry showed the local workspace's database manifest differed from the exact GitHub commit EAS built, so a lockfile validated only against local manifests can still fail remotely.

**How to apply:** Verify the exact workspace manifests and archive contents that EAS will use. For direct uploads, when mobile/shared manifests match the last successful build, a detached temporary worktree with that version-6 lockfile lets pnpm 8.9.2 install without changing the local pnpm 9/10 lockfile. Validate with a frozen install using pnpm 8.9.2; confirm `.easignore` retains required app/shared files while excluding unrelated large assets. If manifests differ, regenerate the version-6 lockfile in an isolated worktree with a separate modules directory and review resolved mobile package versions. In this workspace, pnpm 10's `--config.lockfile-version=6.0` did not down-convert the version-9 lockfile, so verify the generated header rather than trusting the flag.