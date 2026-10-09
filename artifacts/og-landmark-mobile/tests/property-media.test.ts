import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizePropertyMedia, resolveMediaUrl } from '../lib/propertyMedia';

const API_BASE = 'https://www.oglandmark.com';

test('resolves relative listing media paths to absolute mobile-safe URLs', () => {
  assert.equal(
    resolveMediaUrl('/images/uploads/house.jpg', API_BASE),
    'https://www.oglandmark.com/images/uploads/house.jpg',
  );
  assert.equal(
    resolveMediaUrl('images/uploads/house.jpg', API_BASE),
    'https://www.oglandmark.com/images/uploads/house.jpg',
  );
});

test('normalizes listing gallery, cover, and video URLs without changing other data', () => {
  const original = {
    id: 7,
    images: ['/images/uploads/front.jpg', 'https://cdn.example.com/garden.jpg'],
    coverImage: '/images/uploads/front.jpg',
    videoUrl: '/images/uploads/tour.mp4',
    title: 'QA listing',
  };

  const normalized = normalizePropertyMedia(original, API_BASE);

  assert.deepEqual(normalized, {
    id: 7,
    images: [
      'https://www.oglandmark.com/images/uploads/front.jpg',
      'https://cdn.example.com/garden.jpg',
    ],
    coverImage: 'https://www.oglandmark.com/images/uploads/front.jpg',
    videoUrl: 'https://www.oglandmark.com/images/uploads/tour.mp4',
    title: 'QA listing',
  });
  assert.equal(original.images[0], '/images/uploads/front.jpg');
});

test('keeps external media hosts and canonicalizes OG Landmark URLs', () => {
  assert.equal(
    resolveMediaUrl('https://oglandmark.com/images/uploads/house.jpg', API_BASE),
    'https://www.oglandmark.com/images/uploads/house.jpg',
  );
  assert.equal(
    resolveMediaUrl('https://media.example.com/house.jpg', API_BASE),
    'https://media.example.com/house.jpg',
  );
  assert.equal(resolveMediaUrl(null, API_BASE), undefined);
});
