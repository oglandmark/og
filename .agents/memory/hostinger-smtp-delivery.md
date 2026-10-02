---
name: Hostinger SMTP delivery
description: Password reset and admin OTP email delivery depends on a real Hostinger mailbox and SMTP credentials.
---

Hostinger email sending requires the full mailbox address as the SMTP username and that mailbox's password, with `smtp.hostinger.com` on port 465/secure TLS or port 587/non-secure TLS. A configured database does not imply SMTP is configured.

**Why:** The app can authenticate and store an OTP successfully while email delivery remains unavailable when SMTP credentials are absent or belong to the hosting account instead of the mailbox.

**How to apply:** Check `/api/health` for `smtp: "configured"` and the runtime log for `SMTP status: connected`; never put the SMTP password in chat, source, or the ZIP.

A successful Laravel CLI config check does not prove the managed API workflow has received the credentials. In this workspace, the shell reported both SMTP keys present while the restarted API workflow still reported `smtp: "not_configured"`.

**Why:** Reset-email behavior reads the long-running API process's config, which can differ from a one-off CLI process even when the project secret inventory lists the keys.

**How to apply:** Verify `/api/healthz` through the running API workflow after a restart before attempting an inbox-delivery test. If CLI and workflow results disagree, refresh the credentials through the Secrets flow and recheck the workflow.