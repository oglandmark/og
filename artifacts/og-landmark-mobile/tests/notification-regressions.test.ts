import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const server = readFileSync(new URL('../../og-landmark-web/server.js', import.meta.url), 'utf8');
const api = readFileSync(new URL('../lib/api.ts', import.meta.url), 'utf8');
const center = readFileSync(new URL('../app/notifications.tsx', import.meta.url), 'utf8');
const push = readFileSync(new URL('../lib/pushNotifications.ts', import.meta.url), 'utf8');

test('notification APIs are user scoped and support durable read/delete state', () => {
  assert.ok(server.includes("app.get('/api/notifications', requireAuth"));
  assert.match(server, /Number\(n\.recipientUserId \?\? n\.userId\) === req\.currentUser\.id/);
  assert.match(server, /userDeletedAt: null/);
  assert.match(server, /notificationId/);
  assert.match(server, /eventKey/);
});

test('property and project events use preference-aware notification delivery', () => {
  assert.match(server, /usersForPropertyAlert/);
  assert.match(server, /usersForProjectAlert/);
  assert.match(server, /notificationPreferenceEnabled/);
  assert.match(server, /NEW_PROJECT/);
  assert.match(server, /PROPERTY_APPROVED/);
});

test('mobile notification contract includes pagination, preferences and deep links', () => {
  assert.match(api, /getNotificationUnreadCount/);
  assert.match(api, /markAllNotificationsRead/);
  assert.match(api, /updateNotificationPreferences/);
  assert.match(center, /onEndReached/);
  assert.match(center, /\/property\/\[id\]/);
  assert.match(center, /\/announcements\/\[id\]/);
});

test('foreground pushes defer to the in-app notification center', () => {
  assert.match(push, /shouldShowAlert: false/);
  assert.match(push, /shouldShowBanner: false/);
  assert.match(push, /Properties/);
  assert.match(push, /Announcements/);
});