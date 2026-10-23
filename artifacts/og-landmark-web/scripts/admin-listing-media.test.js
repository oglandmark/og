const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  galleryImages,
  isPropertyListRequest,
  propertyList,
  resolveMediaUrl,
} = require('../public/admin/admin-listing-media.js');
const propertyManagementSource = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'admin', 'admin-property-management.js'),
  'utf8',
);
const serverSource = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');

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

test('Admin property management provides requested category and Okara District city filters', () => {
  for (const category of ['Houses', 'Plots & land', 'Commercial', 'Agricultural', 'Industrial', 'Projects']) {
    assert.ok(propertyManagementSource.includes(`'${category}'`), `missing ${category} category`);
  }
  for (const city of ['Okara', 'Depalpur', 'Renala Khurd', 'Haveli Lakha', 'Basir Pur']) {
    assert.ok(propertyManagementSource.includes(`'${city}'`), `missing ${city} city`);
  }
  assert.match(propertyManagementSource, /matchesPropertyFilters\(property\)/);
  assert.match(propertyManagementSource, /row\.hidden = !matchesPropertyFilters\(property\)/);
});

test('Admin counts properties visible in the table and includes the mobile demo catalogue as read-only rows', () => {
  assert.match(propertyManagementSource, /addObservedProperty\(property\)/);
  assert.match(propertyManagementSource, /originalFetch\('\/admin\/demo-properties\.json'\)/);
  assert.match(propertyManagementSource, /ensureMobileDemoRows\(table\)/);
  assert.match(propertyManagementSource, /Mobile app demo/);
  assert.match(propertyManagementSource, /Mobile app project/);
  assert.match(propertyManagementSource, /request\('\/admin\/developer-projects'\)/);
  assert.match(propertyManagementSource, /request\('\/admin\/properties'\)/);
  assert.match(propertyManagementSource, /Read only/);
});

test('Admin properties are unpaginated by default and honor an explicit page limit', () => {
  const routeStart = serverSource.indexOf("app.get('/api/admin/properties'");
  const routeEnd = serverSource.indexOf("app.get('/api/admin/properties/:id/review'", routeStart);
  const route = serverSource.slice(routeStart, routeEnd);
  assert.match(route, /if \(req\.query\.limit !== undefined\)/);
  assert.doesNotMatch(route, /limit = '20'/);
});
