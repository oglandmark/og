---
name: EAS build log redaction
description: EAS startup logs can expose project environment variables in plain text.
---

EAS startup logs may print configured project environment-variable values in the “Project environment variables” section; the separate “Environment secrets” section is masked.

**Why:** A failed Android build included a client-side map key in its startup log output before dependency installation stopped.

**How to apply:** Prefer build status metadata over raw logs. If logs are necessary, never print the full log payload; extract only the specific failure lines and redact environment-variable values before reviewing or summarizing.