---
name: Admin login feedback
description: Keep credential-stage errors visible before the OTP step.
---

Credential and OTP failures must be displayed in the currently visible stage of the admin sign-in flow. Do not place credential failures only inside the OTP panel while it is collapsed.

**Why:** The login API can reject credentials or fail to send an OTP before the OTP stage opens; hiding those errors makes the Continue button appear unresponsive.

**How to apply:** Show credential-stage responses beside the admin login form. Use the OTP panel for errors only after the OTP stage is visible.

Admin session checks must accept the server-issued `admin` permission even when the canonical account role is `User`. The legacy dashboard's client guard checks only the saved role string, so its browser-only session profile must project a verified admin permission as role `Admin`; keep the server account canonical as `User`.

**Why:** The app keeps staff access in permissions while public accounts remain `User`; a role-only client guard otherwise logs a valid administrator out immediately after sign-in.

**How to apply:** Normalize the local dashboard profile during login and synchronously at page startup before the legacy role-only guard runs. Preserve its permission list and continue enforcing authorization from server-owned account data.
