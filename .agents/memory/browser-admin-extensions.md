---
name: Browser admin extensions
description: How to add maintainable features to the static browser admin when its original application source is unavailable.
---

When the browser admin exists only as a compiled bundle with no recoverable source map or matching source in repository history, keep focused enhancements in a readable, separately loaded source module. Avoid hand-editing the compiled bundle or replacing unrelated admin flows.

**Why:** The existing admin bundle contains unrelated working routes; an isolated source module is easier to inspect and test without risking those flows.

**How to apply:** Load the module from the admin entry page, reuse the admin's existing authenticated API session, and cover its DOM behavior with browser checks. Reconsider full source restoration if future changes need to replace or substantially restructure the admin.
