---
name: Browser admin extensions
description: How to add maintainable features to the static browser admin when its original application source is unavailable.
---

When the browser admin exists only as a compiled bundle with no recoverable source map or matching source in repository history, keep focused enhancements in a readable, separately loaded source module. Avoid hand-editing the compiled bundle or replacing unrelated admin flows.

For admin and listing work in this project, update the website admin dashboard and keep its local Replit preview synchronized and verified with each change.

**Why:** The existing admin bundle contains unrelated working routes, and the user clarified that these updates belong on the website admin dashboard and should stay current locally.

**How to apply:** Load focused modules from the admin entry page, reuse the admin's existing authenticated API session, and verify the local web preview after changes. Reconsider full source restoration if future changes need to replace or substantially restructure the admin.
