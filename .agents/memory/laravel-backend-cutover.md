---
name: Fresh Laravel backend
description: User direction for replacing the backend without changing the existing mobile and React website frontends.
---

The user plans to build a new Laravel backend. Keep the current mobile app and React website frontend unchanged during that backend work.

Do not create a ZIP package unless the user explicitly asks for one.

**Why:** The user explicitly asked to remove the previous Laravel implementation and rebuild the backend separately while preserving both clients.

**How to apply:** Build the replacement as backend-only work. Inspect the existing clients' API expectations before implementation, and do not change their source unless the user asks. Never generate a ZIP unless explicitly requested. The mobile app is intended to use `https://www.oglandmark.com` directly; Replit preview and Hostinger production are separate API runtimes and must be verified independently.