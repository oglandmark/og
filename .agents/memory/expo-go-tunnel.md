---
name: Expo Go tunnel routing
description: Use a reachable tunnel for physical Expo Go devices while preserving Replit's Expo-domain preview routing.
---

Replit's Expo host is HTTPS-only, while Expo Go's standard `exp://` URL can try HTTP. For phones outside the Replit network, use Expo's tunnel with a short `EXPO_TUNNEL_SUBDOMAIN`; generated private account slugs can exceed DNS label limits. Keep `EXPO_PACKAGER_PROXY_URL` and `REACT_NATIVE_PACKAGER_HOSTNAME` pointed at `REPLIT_EXPO_DEV_DOMAIN` so the Replit preview route remains configured. The tunnel URL can be provided separately to Expo Go.

**Why:** An automatically generated `exp.direct` name failed DNS validation because a Replit private account slug made one label too long. A short ngrok subdomain returned an Expo iOS manifest over HTTP. Removing the Replit host overrides also made the screenshot service disconnect from the Replit Expo domain.

**How to apply:** Verify the short tunnel's HTTP iOS manifest and the Replit Expo domain's HTTPS `/status` endpoint separately. Restart the managed mobile workflow and use the tunnel QR/URL for physical Expo Go.

For SDK 58, `create-launch login --session` returning an unexpected Expo server response indicates the managed session is stale. The CLI may then prompt to log in or proceed anonymously, which a non-interactive workflow cannot answer. Although `--tunnel ngrok` can connect and produce a QR, it does not repair the unverified-app/authentication prompt.

**Why:** A fresh Replit-managed Expo session is required to authenticate the project; changing tunnel providers only bypasses URL creation and leaves Expo Go unable to trust the project.

**How to apply:** Keep the guarded login step and original tunnel settings. If the login reports an unexpected response, ask the user to refresh the workspace page so Replit reprovisions the session, then restart the managed mobile workflow.
