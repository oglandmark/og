import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { POST_AD_LISTING_ROUTE, shouldOpenPostAdListing } from '../lib/postAdEntry';

const screenSource = readFileSync(
  resolve(fileURLToPath(new URL('../app/(tabs)/post-ad.tsx', import.meta.url))),
  'utf8',
);
const tabLayoutSource = readFileSync(
  resolve(fileURLToPath(new URL('../app/(tabs)/_layout.tsx', import.meta.url))),
  'utf8',
);
const locationPickerSource = readFileSync(
  resolve(fileURLToPath(new URL('../components/LocationPicker.tsx', import.meta.url))),
  'utf8',
);

test('logged-in users open the listing page directly after auth finishes loading', () => {
  assert.equal(shouldOpenPostAdListing(false, true), true);
  assert.equal(POST_AD_LISTING_ROUTE, '/post/listing');
});

test('does not navigate away while auth is still hydrating or the user is signed out', () => {
  assert.equal(shouldOpenPostAdListing(true, true), false);
  assert.equal(shouldOpenPostAdListing(true, false), false);
  assert.equal(shouldOpenPostAdListing(false, false), false);
});

test('Post an Ad uses focus-based direct navigation instead of rendering a Redirect in the tab', () => {
  assert.match(screenSource, /useFocusEffect/);
  assert.match(screenSource, /router\.replace\(POST_AD_LISTING_ROUTE\)/);
  assert.doesNotMatch(screenSource, /<Redirect\b/);
});

test('signed-in Post an Ad tab taps open the listing route without selecting the tab screen', () => {
  assert.match(
    tabLayoutSource,
    /tabPress:\s*\(event\)\s*=>\s*\{\s*if \(isLoading \|\| !isLoggedIn\) return;\s*event\.preventDefault\(\);\s*router\.replace\(POST_AD_LISTING_ROUTE\);/,
  );
});

test('Android tab background avoids BlurView GPU compositing', () => {
  const androidBackground = tabLayoutSource.match(
    /if \(Platform\.OS === 'android'\) \{([\s\S]*?)\n            \}/,
  );
  assert.ok(androidBackground, 'Android must have a dedicated tab background');
  assert.match(androidBackground[1], /backgroundColor: colors\.background/);
  assert.doesNotMatch(androidBackground[1], /<BlurView/);
});

test('the listing form does not mount its native map until the user opens the location picker', () => {
  const guardedMapModal = locationPickerSource.match(/\{mapVisible && \(\s*<Modal[\s\S]*?<\/Modal>\s*\)\}/);
  assert.ok(guardedMapModal, 'the full-screen map modal must only mount while it is visible');
  assert.match(guardedMapModal[0], /<InteractiveMap/);
});

test('all navigation tabs render full labels with wrapping instead of truncating', () => {
  assert.match(tabLayoutSource, /numberOfLines=\{2\}/);
  assert.equal(
    (tabLayoutSource.match(/tabBarLabel:\s*\(\{\s*color\s*\}\)\s*=>\s*<FullTabLabel/g) ?? []).length,
    10,
    'buyer, professional, and profile tabs must all use the full-label component',
  );
});
