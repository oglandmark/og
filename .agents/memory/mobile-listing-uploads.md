---
name: Mobile listing upload compatibility
description: Records the deployment-compatible strategy for property photos selected from Android.
---

On current Expo/React Native Android, append `File` objects from `expo-file-system` and send multipart requests with `expo/fetch`; do not append legacy `{ uri, type, name }` objects. Upload listing photos as one authenticated file per request. If the single-file route is unavailable or returns a server-side multipart compatibility error, retry that same file through the legacy collection route with a one-file form.

**Why:** Newer Android FormData rejects legacy React Native file-part objects with `Unsupported FormDataPart implementation`. Separately, Android `content://` multipart batches can be rejected by older Hostinger proxy/Multer deployments, and retrying a whole batch can duplicate files or exceed request limits.

**How to apply:** Use Expo's `File` and fetch APIs for the client-side multipart part, keep the mobile uploader sequential, preserve authentication failures as real errors, and only use the collection-route fallback for server-side compatibility statuses.

Mobile clients must normalize relative image and video paths to absolute URLs at the API boundary before rendering or storing them in property records. Preserve external CDN URLs.

**Why:** Laravel may return paths such as `/images/uploads/...` when `MEDIA_PUBLIC_BASE_URL` is unset, but native image and video sources need absolute URIs.

**How to apply:** Normalize upload responses and property list, detail, create, and admin-review responses; verify both the admin thumbnail and review gallery paths.