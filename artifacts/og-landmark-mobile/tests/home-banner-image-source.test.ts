import assert from 'node:assert/strict';
import test from 'node:test';
import { shouldUseBundledHomeBanner } from '../lib/homeBannerImageSource';

test('uses the bundled image when the API returns no image URL', () => {
  assert.equal(shouldUseBundledHomeBanner(undefined, 'homes'), true);
  assert.equal(shouldUseBundledHomeBanner('  ', 'homes'), true);
});

test('replaces the known default API banner path with the bundled image', () => {
  assert.equal(
    shouldUseBundledHomeBanner('/images/mobile-banners/homes.jpg', 'homes'),
    true,
  );
  assert.equal(
    shouldUseBundledHomeBanner(
      'https://www.oglandmark.com/images/mobile-banners/homes.jpg?v=2',
      'homes',
    ),
    true,
  );
});

test('preserves custom admin image URLs', () => {
  assert.equal(
    shouldUseBundledHomeBanner('https://cdn.example.com/custom-home.jpg', 'homes'),
    false,
  );
});
