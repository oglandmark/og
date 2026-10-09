const test = require('node:test');
const assert = require('node:assert/strict');
const {
  galleryImages,
  isPropertyListRequest,
  propertyList,
  resolveMediaUrl,
} = require('../public/admin/admin-listing-media.js');

test('resolves relative listing media from the website origin and preserves external URLs', () => {
  assert.equal(
    resolveMediaUrl('/images/uploads/house.jpg', 'https://www.oglandmark.com'),
    'https://www.oglandmark.com/images/uploads/house.jpg',
  );
  assert.equal(
    resolveMediaUrl('https://cdn.example.test/listing.jpg', 'https://www.oglandmark.com'),
    'https://cdn.example.test/listing.jpg',
  );
});

test('returns every gallery image in upload order and includes a distinct cover image once', () => {
  assert.deepEqual(
    galleryImages({
      images: [
        '/images/uploads/front.jpg',
        { url: '/images/uploads/living-room.jpg' },
        '/images/uploads/front.jpg',
      ],
      coverImage: '/images/uploads/cover.jpg',
    }),
    [
      '/images/uploads/front.jpg',
      '/images/uploads/living-room.jpg',
      '/images/uploads/cover.jpg',
    ],
  );
  assert.deepEqual(galleryImages({ images: [], coverImage: '/images/uploads/cover.jpg' }), [
    '/images/uploads/cover.jpg',
  ]);
  assert.deepEqual(galleryImages({ images: [] }), []);
});

test('captures the property list endpoint but not the per-listing review endpoint', () => {
  assert.equal(isPropertyListRequest('/api/admin/properties?status=Pending'), true);
  assert.equal(isPropertyListRequest('https://api.example.test/api/admin/properties/17/review'), false);
  assert.deepEqual(propertyList([{ id: 17 }]), [{ id: 17 }]);
  assert.deepEqual(propertyList({ properties: [{ id: 18 }] }), [{ id: 18 }]);
  assert.deepEqual(propertyList({ error: 'unavailable' }), []);
});
