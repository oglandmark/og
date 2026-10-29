---
name: Mobile listing upload compatibility
description: Records the deployment-compatible strategy for property photos selected from Android.
---

On current Expo/React Native Android, append `File` objects from `expo-file-system` and send multipart requests with `expo/fetch`; do not append legacy `{ uri, type, name }` objects. Upload listing photos as one authenticated file per request. Retry through the legacy collection route only for explicit route or multipart compatibility statuses; never retry generic 5xx or storage-write failures because both routes use the same media storage and a failed response may follow a partial write.

**Why:** Newer Android FormData rejects legacy React Native file-part objects with `Unsupported FormDataPart implementation`. Separately, Android `content://` multipart batches can be rejected by older Hostinger proxy/Multer deployments. Generic server/storage errors will not be fixed by changing route and can duplicate media or leave orphan files.

**How to apply:** Use Expo's `File` and fetch APIs for the client-side multipart part, keep the mobile uploader sequential, preserve authentication failures as real errors, and only use the collection-route fallback for known server-side compatibility statuses.

Mobile clients must normalize relative image and video paths to absolute URLs at the API boundary before rendering or storing them in property records. Preserve external CDN URLs.

**Why:** Laravel may return paths such as `/images/uploads/...` when `MEDIA_PUBLIC_BASE_URL` is unset, but native image and video sources need absolute URIs.

**How to apply:** Normalize upload responses and property list, detail, create, and admin-review responses; verify both the admin thumbnail and review gallery paths.

Persist Laravel media links with the canonical `/api/...` path, not the preview-only `/api-legacy/api/...` alias. Rewrite older stored alias paths when resolving media in web and native clients.

**Why:** The preview alias is registered for Replit routing, while production uses `/api`; persisting the alias can make uploaded photos unreachable outside preview. Native image requests also need the preview alias directly.

**How to apply:** Return canonical API media URLs from Laravel and test old and new paths against both preview and production origins. Resolve canonical `/api/admin/property-media/...` sources to `/api-legacy/api/admin/property-media/...` for Replit web and native previews, while keeping production on `/api`. Native image requests do not pass through the fetch rewrite.

Normalize selected photos to compressed JPEG on-device before upload; accept common video containers explicitly and return size-limit errors separately from unsupported-format errors.

**Why:** iOS gallery photos may be HEIC/HEIF and large originals can exceed host PHP upload limits, while Expo Go does not transparently transcode arbitrary video codecs.

**How to apply:** Resize photos to a reasonable maximum edge and encode JPEG before multipart upload. Keep video format support explicit (for example MP4/MOV/M4V/3GP/WebM/AVI); do not promise arbitrary codecs or bypass server upload limits.