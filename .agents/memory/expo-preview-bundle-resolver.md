---
name: Expo preview bundle resolver
description: Replit Expo preview can expose a bundle-path resolver mismatch even when Metro starts normally.
---

Treat a blank Expo preview with a 404 JSON response for the expo-router web bundle as a preview routing/resolution issue first, not as an application compile failure.

**Why:** In this workspace, Metro reported a healthy start but the proxied bundle request was resolved from the monorepo root and could not find the package-relative expo-router entry. Changing the managed workflow command did not solve it and was restored.

**How to apply:** Verify TypeScript, Metro startup logs, and the exact local bundle response separately. Avoid leaving speculative artifact workflow or Metro path changes in the project unless the resolver behavior is reproduced and the fix is confirmed.