---
name: Expo GitHub build dispatch
description: Handling EAS build-dispatch failures after GitHub linking or Expo project transfer
---

After an Expo project has a linked GitHub repository, a production build request may still return `503 Service Unavailable` from the Expo GraphQL service. A 503 does not prove that a build was created.

**Why:** The build list remained unchanged after the failed dispatch, so retrying without checking could create uncertainty about duplicate builds if the service later accepts a delayed request.

**How to apply:** Check the project's current Android build list after a dispatch error. Retry only when no new queued or in-progress build appears; if repeated 503s continue, report the service-side blocker rather than changing app code.

After transferring an Expo project, the app config's `owner` can still name the old account even though the project URL uses the new account slug. Keep `extra.eas.projectId` unchanged unless the actual EAS project is confirmed to have changed. A read-only `mcpExpo_buildList` call with both `appId` and `appFullName` can verify that those identifiers resolve to the same project's build history.

**Why:** A transferred project can retain its project ID while its account slug changes; checking both identifiers avoids changing the ID based only on the visible project name.

**How to apply:** Align `owner` with the account slug in the project URL, verify the ID/full-name pair with build history, and if `mcpExpo_buildRun` still says `No repository found for appId`, stop repeating the dispatch. Confirm the Expo GitHub App installation and repository binding for that exact project; a UI status alone does not explain the dispatch-service mismatch.

`mcpExpo_buildRun` builds the requested GitHub ref, not the current local workspace. If the latest local commit is not present on an EAS-visible ref, create and push a dedicated build branch, then verify the returned build's commit hash before treating its artifact as current.

**Why:** The workspace's active release branch can lag or diverge from the branch used by the last successful EAS build, so rebuilding that old ref can silently omit recent mobile changes.

**How to apply:** Compare local HEAD with the latest successful EAS build commit; push the intended source to a dedicated branch when needed, and confirm `gitCommitHash`, app version, and Android build number from build metadata.

During longer Android builds, `buildInfo.updatedAt` may stop advancing while Gradle continues. The signed log file listed in `logFiles` can show whether native compilation is still progressing.

**Why:** The build metadata stayed unchanged while the Gradle log continued to receive new native compilation steps.

**How to apply:** For an apparently stalled build, compare the latest sanitized log timestamps before retrying or cancelling. Do not expose signed log URLs or raw environment-rich logs.