---
name: Admin login feedback
description: Keep credential-stage errors visible before the OTP step.
---

Credential and OTP failures must be displayed in the currently visible stage of the admin sign-in flow. Do not place credential failures only inside the OTP panel while it is collapsed.

**Why:** The login API can reject credentials or fail to send an OTP before the OTP stage opens; hiding those errors makes the Continue button appear unresponsive.

**How to apply:** Show credential-stage responses beside the admin login form. Use the OTP panel for errors only after the OTP stage is visible.

Admin session checks must accept the server-issued `admin` permission even when the canonical account role is `User`; do not require the public role string to be `Admin`.

**Why:** The app keeps staff access in permissions while public accounts remain `User`, so strict role checks can reject a valid administrator after successful credential verification.

**How to apply:** Use the returned permissions for Admin login/session acceptance and keep API authorization server-side.
