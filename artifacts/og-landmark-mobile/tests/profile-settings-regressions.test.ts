import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const base = new URL('../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, base), 'utf8');

test('profile redesign keeps the existing bottom tab configuration intact', () => {
  const tabs = read('app/(tabs)/_layout.tsx');
  const names = [...tabs.matchAll(/<Tabs\.Screen name="([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(names, ['index', 'explore', 'post-ad', 'saved', 'dashboard', 'listings', 'projects', 'leads', 'messages', 'calculator', 'profile']);
  assert.match(tabs, /function AnimatedTabBar/);
  assert.match(tabs, /<BottomTabBar \{\.\.\.props\} \/>/);
  assert.match(tabs, /router\.replace\(POST_AD_LISTING_ROUTE\)/);
  assert.match(tabs, /backgroundColor: `\$\{colors\.surfaceRaised\}F2`/);
  assert.match(tabs, /postIcon:  \{ width: 56/);
  assert.match(tabs, /Inter_500Medium/);
});

test('guest profile uses the light welcome-card layout and three locked activity rows', () => {
  const profile = read('app/(tabs)/profile.tsx');
  for (const text of ['Saved Properties', 'Saved Searches', 'Search Alerts', 'Your Activity', 'Sign in to unlock your profile']) {
    assert.ok(profile.includes(text), `guest profile is missing ${text}`);
  }
  assert.match(profile, /backgroundColor: colors\.surfaceTint/);
  assert.match(profile, /<LinearGradient/);
  assert.equal((profile.match(/label: 'Saved Properties'|label: 'Saved Searches'|label: 'Search Alerts'/g) || []).length, 3);
  assert.ok(!profile.includes("label: 'Visits'"));
  assert.match(profile, /guest-settings/);
  assert.match(profile, /guest-sign-in/);
  assert.match(profile, /guest-create-account/);
  assert.ok(profile.includes("router.push('/(auth)/login'"));
  assert.ok(profile.includes("router.push('/(auth)/signup'"));
});

test('activity and Settings options use a restrained, professional card hierarchy', () => {
  const profile = read('app/(tabs)/profile.tsx');
  const settings = read('app/settings/index.tsx');
  assert.match(profile, /activityLabel: \{ fontFamily: 'Inter_500Medium'/);
  assert.match(profile, /signInPill: \{[^}]*borderWidth: 1/);
  assert.match(settings, /backgroundColor: colors\.surfaceTint/);
  assert.match(settings, /rowTitle: \{ fontFamily: 'Inter_500Medium'/);
  assert.match(settings, /row: \{ minHeight: 72, borderWidth: 1, borderRadius: 17/);
});

test('settings home is reachable and retains public, account, notification and deletion actions', () => {
  const profile = read('app/(tabs)/profile.tsx');
  const settings = read('app/settings/index.tsx');
  assert.ok(profile.includes("router.push('/settings'"));
  for (const route of ['/settings/language', '/settings/help', '/settings/legal?section=about', '/settings/legal?section=security', '/settings/legal?section=legal', '/settings/account', '/settings/notifications']) {
    assert.ok(settings.includes(route), `settings home is missing ${route}`);
  }
  for (const behavior of ['registerPushTokenForUser', 'deleteMyAccount', 'clearLocalAccountData', "title: 'Sign Out'", 'settings-delete-account']) {
    assert.ok(settings.includes(behavior), `settings home is missing ${behavior}`);
  }
});
