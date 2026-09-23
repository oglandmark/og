---
name: Hostinger media recovery
description: Uploaded media and app_data references must be backed up and restored as one recovery unit.
---

Production listing media is file-backed while its URLs and metadata live in `app_data`; a database-only backup can restore listings with broken photos or videos.

**Why:** Hostinger deploy and rollback directories can be replaced independently of a persistent volume, so a healthy database does not prove that listing media survived.

**How to apply:** Keep `MEDIA_STORAGE_DIR` on a persistent volume or synchronized object-storage directory, require the production health check to show persistent/readable storage, and run the paired backup plus live URL smoke test after every restore or redeploy.