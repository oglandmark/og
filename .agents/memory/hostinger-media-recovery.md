---
name: Hostinger media recovery
description: Uploaded media and app_data references must be backed up and restored as one recovery unit.
---

Production listing media is file-backed while its URLs and metadata live in `app_data`; a database-only backup can restore listings with broken photos or videos.

**Why:** Hostinger deploy and rollback directories can be replaced independently of a persistent volume, so a healthy database does not prove that listing media survived.

**How to apply:** Keep `MEDIA_STORAGE_DIR` on a persistent volume or synchronized object-storage directory, require the production health check to show persistent/readable storage, and run the paired backup plus live URL smoke test after every restore or redeploy.

`mediaStorage.persistent: true` alone does not mean uploads can write; the production health response must also report `mediaStorage.ready: true`. A missing `MEDIA_PUBLIC_BASE_URL` is not by itself an upload blocker when clients resolve relative media paths against the API origin.

**Why:** The live API can report persistent storage configured while its directory is still not readable or writable, causing uploads to return `MEDIA_STORAGE_NOT_READY`.

**How to apply:** When mobile uploads fail, check `/api/healthz` first. Fix the real persistent directory path or permissions in Hostinger rather than retrying another upload endpoint or changing client URL handling.