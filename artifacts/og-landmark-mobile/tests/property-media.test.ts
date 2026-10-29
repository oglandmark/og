import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { normalizePropertyMedia, resolveMediaUrl } from '../lib/propertyMedia';

const API_BASE = 'https://www.oglandmark.com';
const propertyModelSource = readFileSync(new URL('../lib/properties.ts', import.meta.url), 'utf8');

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

test('normalizes legacy Laravel media routes for preview and production', () => {
  const previewApiBase = 'https://preview.replit.dev/api-legacy';
  assert.equal(
    resolveMediaUrl('/api-legacy/api/admin/property-media/tour.mp4', previewApiBase),
    'https://preview.replit.dev/api-legacy/api/admin/property-media/tour.mp4',
  );
  assert.equal(
    resolveMediaUrl('/api/admin/property-media/front.webp', previewApiBase),
    'https://preview.replit.dev/api-legacy/api/admin/property-media/front.webp',
  );
  assert.equal(
    resolveMediaUrl('https://www.oglandmark.com/api-legacy/api/admin/property-media/tour.mp4', API_BASE),
    'https://www.oglandmark.com/api/admin/property-media/tour.mp4',
  );
  assert.equal(
    resolveMediaUrl('https://www.oglandmark.com/images/uploads/existing-tour.mp4', previewApiBase),
    'https://www.oglandmark.com/images/uploads/existing-tour.mp4',
  );
  assert.equal(
    resolveMediaUrl('https://cdn.example.com/existing-tour.mp4', previewApiBase),
    'https://cdn.example.com/existing-tour.mp4',
  );
});

test('mobile API property mapping carries video URLs into the playback model', () => {
  assert.match(propertyModelSource, /videoUrl\?: string \| null/);
  assert.match(propertyModelSource, /videoUrl:\s*resolveMediaUrl\(ap\.videoUrl,\s*API_BASE\)/);
  assert.match(propertyModelSource, /coverImage\?: string \| null/);
  assert.match(propertyModelSource, /uploadedImages\.length[\s\S]*ap\.coverImage\s*\?\s*\[ap\.coverImage\]/);
  assert.match(propertyModelSource, /return resolveMediaUrl\(url,\s*API_BASE\)/);
});
