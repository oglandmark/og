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
