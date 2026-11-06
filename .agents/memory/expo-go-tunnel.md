---
name: Expo Go tunnel routing
description: Use a reachable tunnel for physical Expo Go devices while preserving Replit's Expo-domain preview routing.
---

Replit's Expo host is HTTPS-only, while Expo Go's standard `exp://` URL can try HTTP. For phones outside the Replit network, use Expo's tunnel with a short `EXPO_TUNNEL_SUBDOMAIN`; generated private account slugs can exceed DNS label limits. Keep `EXPO_PACKAGER_PROXY_URL` and `REACT_NATIVE_PACKAGER_HOSTNAME` pointed at `REPLIT_EXPO_DEV_DOMAIN` so the Replit preview route remains configured. The tunnel URL can be provided separately to Expo Go.

**Why:** An automatically generated `exp.direct` name failed DNS validation because a Replit private account slug made one label too long. A short ngrok subdomain returned an Expo iOS manifest over HTTP. Removing the Replit host overrides also made the screenshot service disconnect from the Replit Expo domain.

**How to apply:** Verify the short tunnel's HTTP iOS manifest and the Replit Expo domain's HTTPS `/status` endpoint separately. Restart the managed mobile workflow and use the tunnel QR/URL for physical Expo Go.
