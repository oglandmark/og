---
name: Website account portal live parity
description: Distinguish the Replit user portal source from the legacy account screens visible on the published website.
---

The published `oglandmark.com/user/*` screenshots showed a legacy account dashboard with sample records, while the current Replit source serves a separate account portal. Local source changes and preview/API tests do not establish that the public domain now serves those changes.

Preserve the existing User dashboard design; the user asked for functional improvements without visual redesign.

**Why:** Users may continue to see stale sample data and broken controls on the live domain even after the local portal is fixed.

**How to apply:** Keep changes focused on behavior unless the user asks for visual changes. After account-portal changes, verify the published `/user` routes and authentication behavior independently; do not claim production is fixed based only on the Replit preview.
