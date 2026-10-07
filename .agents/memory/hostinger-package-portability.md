---
name: Hostinger package portability
description: Keeps Hostinger deployment archives portable and synchronized with current website source.
---

External Hostinger deployment ZIPs must not include Replit-generated npm lockfiles because their resolved URLs can point at the private package-firewall registry.

After changing public legal pages, regenerate both the full frontend package and the focused upload overlay from the current source. Verify the page contents and route rules in every package copy, including nested build archives, before presenting them.

**Why:** Hostinger cannot resolve `package-firewall.replit.local`, causing dependency installation to fail before the app build starts. Separately, ZIP copies can retain older page content even after the working website is updated.

**How to apply:** Ship standalone Node packages with `.npmrc` set to `https://registry.npmjs.org/` and omit workspace lockfiles. For legal-page updates, build the full package and the focused overlay from the same source, then compare their archived pages and rewrites—including nested ZIPs—before delivery.