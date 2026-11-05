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

test('guest profile keeps six activity rows and five Settings options on the page', () => {
  const profile = read('app/(tabs)/profile.tsx');
  for (const text of [
    'Saved Properties', 'Saved Searches', 'Search Alerts', 'Scheduled Visits',
    'My Inquiries', 'Recently Viewed', 'Your Activity', 'Settings',
    'Language', 'Help & Support', 'About OG Landmark', 'Privacy & Security', 'Terms & Privacy',
    'OG Landmark v1.0 · Guest Mode',
  ]) {
    assert.ok(profile.includes(text), `guest profile is missing ${text}`);
  }
  assert.match(profile, /backgroundColor: colors\.surfaceTint/);
  assert.match(profile, /<LinearGradient/);
  const activityItems = profile.match(/const LOCKED_ITEMS:[\s\S]*?\n  \];/)?.[0] ?? '';
  const settingsItems = profile.match(/const SETTINGS_ITEMS:[\s\S]*?\n  \];/)?.[0] ?? '';
  assert.equal((activityItems.match(/^\s+\{ icon:/gm) || []).length, 6);
  assert.equal((settingsItems.match(/^\s+\{ icon:/gm) || []).length, 5);
  for (const route of ['/settings/language', '/settings/help', '/settings/legal?section=about', '/settings/legal?section=security', '/settings/legal?section=legal']) {
    assert.ok(settingsItems.includes(route), `guest Settings is missing ${route}`);
  }
  assert.match(profile, /router\.push\(item\.route as any\)/);
  assert.match(profile, /guest-settings/);
  assert.match(profile, /guestScrollRef\.current\?\.scrollTo\(\{ y: 0, animated: false \}\)/);
  assert.match(profile, /ref=\{scrollRef\}/);
  assert.match(profile, /guest-sign-in/);
  assert.match(profile, /guest-create-account/);
  assert.ok(profile.includes("router.push('/(auth)/login'"));
  assert.ok(profile.includes("router.push('/(auth)/signup'"));
});

test('guest Profile calls to action match the shared button sizing', () => {
  const profile = read('app/(tabs)/profile.tsx');
  const loginStyle = profile.match(/^\s+loginBtn: \{([^}]*)\}/m)?.[1] ?? '';
  const registerStyle = profile.match(/^\s+registerBtn: \{([^}]*)\}/m)?.[1] ?? '';
  for (const style of [loginStyle, registerStyle]) {
    assert.match(style, /borderRadius: 14/);
    assert.match(style, /minHeight: 46/);
    assert.match(style, /width: 270/);
    assert.match(style, /alignSelf: 'center'/);
    assert.match(style, /paddingHorizontal: 20/);
  }
});

test('guest and signed-in Profile headers animate the shared logo in web preview', () => {
  const profile = read('app/(tabs)/profile.tsx');
  const brandMark = read('components/BrandMark.tsx');
  assert.equal((profile.match(/<BrandMark animateOnWeb focused=\{profileFocused\} \/>/g) || []).length, 1);
  assert.equal((profile.match(/<BrandMark animateOnWeb focused=\{focused\} \/>/g) || []).length, 1);
  assert.match(profile, /setProfileFocused\(true\)/);
  assert.match(brandMark, /animateOnWeb\?: boolean/);
  assert.match(brandMark, /animateOnWeb=\{animateOnWeb\}/);
  assert.match(brandMark, /focused=\{focused\}/);
});

test('activity and Settings options use a restrained, professional card hierarchy', () => {
  const profile = read('app/(tabs)/profile.tsx');
  const settings = read('app/settings/index.tsx');
  assert.match(profile, /activityLabel: \{ fontFamily: 'Inter_400Regular'/);
  assert.match(profile, /label:\s+\{ fontFamily: 'Inter_500Medium', fontSize: 14 \}/);
  assert.match(profile, /signInPillText: \{ fontFamily: 'Inter_400Regular'/);
  assert.match(profile, /signInPill: \{[^}]*borderWidth: 1/);
  assert.match(settings, /backgroundColor: colors\.surfaceTint/);
  assert.match(settings, /rowTitle: \{ fontFamily: 'Inter_500Medium'/);
  assert.match(settings, /row: \{ minHeight: 72, borderWidth: 1, borderRadius: 17/);
});

test('web preview loads brand fonts and keeps the tab dock opaque', () => {
  const root = read('app/_layout.tsx');
  const tabs = read('app/(tabs)/_layout.tsx');
  assert.match(root, /const fontDefinitions: Record<string, FontSource> = \{/);
  assert.ok(!root.includes("Platform.OS === 'web' ? {} :"));
  const webBackground = tabs.match(/if \(Platform\.OS === 'web'\) \{([\s\S]*?)\n            \}/);
  assert.ok(webBackground, 'web tab dock background should be defined');
  assert.match(webBackground[1], /backgroundColor: colors\.surfaceRaised/);
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
