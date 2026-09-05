---
name: Expo GitHub build dispatch
description: Handling transient EAS build-dispatch failures after linking a GitHub repository
---

After an Expo project has a linked GitHub repository, a production build request may still return `503 Service Unavailable` from the Expo GraphQL service. A 503 does not prove that a build was created.

**Why:** The build list remained unchanged after the failed dispatch, so retrying without checking could create uncertainty about duplicate builds if the service later accepts a delayed request.

**How to apply:** Check the project's current Android build list after a dispatch error. Retry only when no new queued or in-progress build appears; if repeated 503s continue, report the service-side blocker rather than changing app code.