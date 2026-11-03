---
name: Fresh Laravel backend
description: User direction for replacing the backend without changing the existing mobile and React website frontends.
---

The user selected the existing Hostinger MySQL as the Laravel backend target. Keep the Replit preview on local SQLite; do not send preview mutations to Hostinger or migrate production data without explicit approval. Keep the current mobile app and React website design unchanged.

Do not create a ZIP package unless the user explicitly asks for one.

**Why:** The user asked to rebuild the backend separately, selected Hostinger MySQL, and prohibited ZIP creation until they ask. Replit preview and Hostinger are separate runtimes, and preview writes could change live records.

**How to apply:** Preserve the mobile app and website design; make only API-routing changes needed for the Laravel cutover. Use local SQLite for preview and test Hostinger MySQL only after the user explicitly approves live writes or a migration. Never generate a ZIP unless explicitly requested. The mobile app is intended to use `https://www.oglandmark.com` directly; verify Replit preview and Hostinger independently.