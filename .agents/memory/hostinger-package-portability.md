---
name: Hostinger package portability
description: Keeps Hostinger deployment archives portable and synchronized with current website source.
---

External Hostinger deployment ZIPs must not include Replit-generated npm lockfiles because their resolved URLs can point at the private package-firewall registry.

After changing public legal pages or contact details, rebuild from the latest supplied frontend ZIP. Regenerate the focused overlay too unless the user asks for one archive only. Verify homepage bundle values, cache-busted HTML references, legal pages, and route rules across source/build copies and nested archives.

**Why:** Hostinger cannot resolve `package-firewall.replit.local`, causing dependency installation to fail before the app build starts. Public contact text can also be transformed separately in the runtime asset route and static builder, while unchanged JavaScript URLs may remain cached.

**How to apply:** Ship standalone Node packages with `.npmrc` set to `https://registry.npmjs.org/` and omit workspace lockfiles. Keep runtime and static contact rewrites in sync, bump the homepage bundle URL, fetch the served JavaScript, and compare every requested archive copy—including nested ZIPs—before delivery.