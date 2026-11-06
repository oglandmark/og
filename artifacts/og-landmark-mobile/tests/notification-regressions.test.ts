import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { normalizeNotificationPage } from '../lib/notificationData';

const server = readFileSync(new URL('../../og-landmark-web/server.js', import.meta.url), 'utf8');
const api = readFileSync(new URL('../lib/api.ts', import.meta.url), 'utf8');
const center = readFileSync(new URL('../app/notifications.tsx', import.meta.url), 'utf8');
const home = readFileSync(new URL('../app/(tabs)/index.tsx', import.meta.url), 'utf8');
const bell = readFileSync(new URL('../components/NotificationBell.tsx', import.meta.url), 'utf8');
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
  assert.match(api, /normalizeNotificationPage\(response, options\)/);
  assert.match(center, /onEndReached/);
  assert.match(center, /\/property\/\[id\]/);
  assert.match(center, /\/announcements\/\[id\]/);
});

test('notification center accepts Laravel array responses and paginates safely', () => {
  const result = normalizeNotificationPage([
    { id: 11, userId: 7, message: 'Older property update', category: 'properties', read: true },
    { id: 12, userId: 7, message: 'New project update', category: 'projects', read: false },
    { id: 13, userId: 7, message: 'New property update', category: 'properties', read: false },
  ], { page: 1, limit: 1, category: 'properties' });

  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].notificationId, '11');
  assert.equal(result.items[0].title, 'Older property update');
  assert.equal(result.items[0].body, 'Older property update');
  assert.equal(result.total, 2);
  assert.equal(result.hasMore, true);
  assert.equal(result.unreadCount, 1);

  const paginated = normalizeNotificationPage({
    items: [{ id: 14, title: 'Account update', category: 'account', isRead: false }],
    page: 3,
    limit: 10,
    total: 23,
    hasMore: true,
    unreadCount: 4,
  }, { page: 3, limit: 10 });
  assert.equal(paginated.page, 3);
  assert.equal(paginated.total, 23);
  assert.equal(paginated.unreadCount, 4);
});

test('home notification bell and notification center remain accessible to guests', () => {
  assert.match(home, /<NotificationBell compact \/>/);
  assert.doesNotMatch(home, /\{user \? <NotificationBell compact \/>/);
  assert.match(bell, /router\.push\('\/notifications'/);
  assert.match(center, /Sign in to view notifications/);
  assert.match(center, /notification-sign-in/);
});

test('foreground pushes defer to the in-app notification center', () => {
  assert.match(push, /shouldShowAlert: false/);
  assert.match(push, /shouldShowBanner: false/);
  assert.match(push, /Properties/);
  assert.match(push, /Announcements/);
});