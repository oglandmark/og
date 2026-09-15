---
name: Mobile listing upload compatibility
description: Records the deployment-compatible strategy for property photos selected from Android.
---

Property listing photos should be uploaded as one authenticated file per request. If the single-file route is unavailable or returns a multipart compatibility error, retry that same file through the legacy collection route with a one-file form.

**Why:** Android `content://` multipart batches can be rejected by older Hostinger proxy/Multer deployments, and retrying a whole batch can duplicate files or exceed request limits.

**How to apply:** Keep the mobile uploader sequential and preserve authentication failures as real errors; only use the collection-route fallback for server-side compatibility statuses.