---
name: GitHub connector write fallback
description: Recovery path when GitHub contents writes are blocked by the connector or Cloudflare.
---

The GitHub contents write endpoint can return an HTML Cloudflare 403 for some source-file payloads even when reads and other file writes work. The credential-injected Git data API remains a viable fallback: create blobs, create a tree based on the current main tree, create a commit, then fast-forward refs/heads/main.

**Why:** Direct shell pushes may not have GitHub credentials, and repeatedly retrying the same contents endpoint does not reliably recover from the connector block.

**How to apply:** Read the current remote ref/tree first, include only the intended changed paths, publish one atomic tree/commit, and verify remote file parity afterward. Never handle or display the connection credential.