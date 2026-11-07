import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const mobileRoot = new URL('../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, mobileRoot), 'utf8');

const refreshableDataScreens = [
  'app/(tabs)/index.tsx',
  'app/(tabs)/explore.tsx',
  'app/(tabs)/listings.tsx',
  'app/(tabs)/projects.tsx',
  'app/(tabs)/saved.tsx',
  'app/(tabs)/dashboard.tsx',
  'app/(tabs)/leads.tsx',
  'app/(tabs)/messages.tsx',
  'app/notifications.tsx',
  'app/agent/find.tsx',
  'app/agent/visits.tsx',
  'app/developer/analytics.tsx',
  'app/developer/documents.tsx',
  'app/developer/inventory.tsx',
  'app/developer/payment-plans.tsx',
  'app/developer/site-visits.tsx',
  'app/developer/team.tsx',
  'app/admin/index.tsx',
  'app/admin/notifications.tsx',
  'app/admin/properties.tsx',
  'app/admin/reports.tsx',
  'app/admin/users.tsx',
  'app/admin/banners.tsx',
];

test('eligible data and list screens expose the shared branded pull-to-refresh', () => {
  for (const path of refreshableDataScreens) {
    assert.match(read(path), /BrandedRefreshControl/, `${path} should support pull-to-refresh`);
  }
});

test('auth and settings forms do not expose pull-to-refresh', () => {
  for (const path of [
    'app/(auth)/login.tsx',
    'app/(auth)/signup.tsx',
    'app/post/listing.tsx',
    'app/settings/account.tsx',
    'app/settings/notifications.tsx',
  ]) {
    assert.doesNotMatch(read(path), /BrandedRefreshControl/, `${path} should preserve entered form state`);
  }
});

test('the shared refresh animation uses OG Landmark brand colors', () => {
  const control = read('components/BrandedRefreshControl.tsx');
  assert.match(control, /tintColor=\{colors\.teal\}/);
  assert.match(control, /colors=\{\[colors\.teal, colors\.gold, colors\.action\]\}/);
  assert.match(control, /title=\{Platform\.OS === 'ios' \? label : undefined\}/);
});

test('Home disables refresh in web and Android development previews', () => {
  const home = read('app/(tabs)/index.tsx');
  assert.match(home, /refreshControl=\{Platform\.OS === 'web' \|\| \(__DEV__ && Platform\.OS === 'android'\) \? undefined : \(/);
  assert.match(home, /<BrandedRefreshControl refreshing=\{refreshing\}/);
});

test('Home only shows its full-feed loader for the first property request', () => {
  const home = read('app/(tabs)/index.tsx');
  assert.match(home, /homePropertiesRequestedRef = useRef\(false\)/);
  assert.match(home, /firstLoad && !homePropertiesRequestedRef\.current/);
});
