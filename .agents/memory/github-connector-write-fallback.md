---
name: GitHub connector write fallback
description: Recovery path when GitHub contents writes are blocked by the connector or Cloudflare.
---

The GitHub contents write endpoint can return an HTML Cloudflare 403 for some source-file payloads even when reads and other file writes work. The credential-injected Git data API remains a viable fallback: create blobs, create a tree based on the current main tree, create a commit, then fast-forward refs/heads/main.

**Why:** Direct shell pushes may not have GitHub credentials, and repeatedly retrying the same contents endpoint does not reliably recover from the connector block.

**How to apply:** Read the current remote ref/tree first, include only the intended changed paths, publish one atomic tree/commit, and verify remote file parity afterward. Never handle or display the connection credential.

For bulk source syncs, avoid parsing a large Base64 JSON payload directly from `shellExec` stdout. Stage each bounded batch as a temporary workspace file, read it as text, and verify each Git blob hash and byte size against the source manifest before uploading.

**Why:** A large callback stdout payload produced malformed JSON in the durable runtime, while the same payload staged to a file could be read and verified reliably.

**How to apply:** Keep temporary payloads out of version control, split batches below the file-read limit, validate before creating blobs, and remove staging files after the sync.