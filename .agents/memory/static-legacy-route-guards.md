---
name: Static legacy route guards
description: Keep legacy HTML dashboard URLs redirected in both the Express preview and static production hosting.
---

When a legacy HTML file must stop acting as a dashboard but still powers a focused workflow, server-side redirects alone may be insufficient: static hosting can serve the file directly. Put a path guard in the HTML itself and allow only an explicit query parameter for the workflow that still needs the page. Keep workflow links pointed at that allowed URL.

**Why:** The website is deployed as static files in production, so a route handler that redirects in the local Express preview may not run for an existing HTML asset.

**How to apply:** For retired portal pages that still host create/edit flows, verify both the direct legacy URL and the explicitly allowed workflow URL in local routing and the built static output.
