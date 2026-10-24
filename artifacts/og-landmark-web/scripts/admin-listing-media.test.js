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
const mobileManagementSource = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'admin', 'admin-mobile-management.js'),
  'utf8',
);
const serverSource = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
const apiControllerSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'api-server', 'laravel', 'app', 'Http', 'Controllers', 'ApiController.php'),
  'utf8',
);

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

test('Admin can filter and persist featured status for live mobile properties', () => {
  assert.match(propertyManagementSource, /Featured only/);
  assert.match(propertyManagementSource, /Not featured/);
  assert.match(propertyManagementSource, /data-og-featured-header/);
  assert.match(propertyManagementSource, /\/admin\/properties\/\$\{encodeURIComponent\(property\.id\)\}\/feature/);
  assert.match(propertyManagementSource, /JSON\.stringify\(\{ featured: nextFeatured \}\)/);
  assert.match(propertyManagementSource, /property\.isDemo \|\| property\.isProject/);
  assert.match(propertyManagementSource, /featuredFilter/);
});

test('Admin can select and filter persistent Recommended listings for mobile Home', () => {
  assert.match(propertyManagementSource, /Recommended only/);
  assert.match(propertyManagementSource, /Not recommended/);
  assert.match(propertyManagementSource, /data-og-recommended-header/);
  assert.match(propertyManagementSource, /\/admin\/properties\/\$\{encodeURIComponent\(property\.id\)\}\/recommend/);
  assert.match(propertyManagementSource, /JSON\.stringify\(\{ recommended: nextRecommended \}\)/);
  assert.match(propertyManagementSource, /property\.isDemo \|\| property\.isProject/);
  assert.match(propertyManagementSource, /recommendedFilter/);
  assert.ok(apiControllerSource.includes("'feature', 'recommend'"));
  assert.ok(apiControllerSource.includes("($parts[2] ?? '') === 'recommend'"));
  assert.ok(apiControllerSource.includes("$data['properties'][$index]['recommended']"));
  assert.ok(apiControllerSource.includes("'recommended' => false"));
});

test('Admin separates the automatic latest six live listings from the full property table', () => {
  assert.match(propertyManagementSource, /Latest 6 on mobile/);
  assert.match(propertyManagementSource, /data-og-latest-panel/);
  assert.match(propertyManagementSource, /Newest approved listings currently shown in the mobile app/);
  assert.match(propertyManagementSource, /isMobilePublicListing/);
  assert.match(propertyManagementSource, /createdAt/);
});

test('Admin project management supports app-shaped create/edit and safe archive flows', () => {
  assert.match(mobileManagementSource, /title: 'Developer projects', list: '\/admin\/developer-projects', createPath: '\/admin\/developer-projects'/);
  assert.match(mobileManagementSource, /deletePath: \(item\) => `\/admin\/developer-projects\/\$\{encodeURIComponent\(item\.id\)\}`/);
  assert.match(mobileManagementSource, /'name', 'Project name \*'/);
  assert.match(mobileManagementSource, /'fullDescription', 'Full project description', 'textarea'/);
  assert.match(mobileManagementSource, /'photos', 'Gallery image URLs \(one per line\)', 'textarea'/);
  assert.match(mobileManagementSource, /payload\.name = String\(payload\.name \|\| ''\)\.trim\(\)/);
  assert.match(mobileManagementSource, /payload\.title = payload\.name/);
  assert.match(mobileManagementSource, /payload\.developer = payload\.developerName/);
  assert.match(mobileManagementSource, /status to Live or Approved to publish/);
  assert.match(mobileManagementSource, /preserving linked blocks, units, and inventory/);
});

test('Agriculture Land has a separate Admin option with its own summary and category scope', () => {
  assert.match(mobileManagementSource, /label: 'Agriculture Land', path: '\/admin\/properties\?propertyView=agriculture'/);
  assert.match(propertyManagementSource, /const agricultureView = requestedView === 'agriculture'/);
  assert.match(propertyManagementSource, /categoryFilter = agricultureView \? 'agricultural' : 'all'/);
  assert.match(propertyManagementSource, /function renderAgricultureOverview\(root\)/);
  assert.match(propertyManagementSource, /Land listings|agriculture land/i);
  assert.match(propertyManagementSource, /matchesCategory\(property, 'agricultural'\)/);
});

test('Admin properties are unpaginated by default and honor an explicit page limit', () => {
  const routeStart = serverSource.indexOf("app.get('/api/admin/properties'");
  const routeEnd = serverSource.indexOf("app.get('/api/admin/properties/:id/review'", routeStart);
  const route = serverSource.slice(routeStart, routeEnd);
  assert.match(route, /if \(req\.query\.limit !== undefined\)/);
  assert.doesNotMatch(route, /limit = '20'/);
});
