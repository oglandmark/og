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
  path.join(__dirname, '..', '..', 'api-server', 'laravel', 'app', 'Http', 'Controllers', 'Api', 'PropertyController.php'),
  'utf8',
);
const adminControllerSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'api-server', 'laravel', 'app', 'Http', 'Controllers', 'Api', 'AdminController.php'),
  'utf8',
);
const apiRoutesSource = fs.readFileSync(
  path.join(__dirname, '..', '..', 'api-server', 'laravel', 'routes', 'api.php'),
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
  assert.equal(
    resolveMediaUrl('/api-legacy/api/admin/property-media/front.jpg', 'https://www.oglandmark.com'),
    'https://www.oglandmark.com/api/admin/property-media/front.jpg',
  );
  assert.equal(
    resolveMediaUrl('/api/admin/property-media/front.jpg', 'https://preview.replit.dev'),
    'https://preview.replit.dev/api-legacy/api/admin/property-media/front.jpg',
  );
  assert.equal(
    resolveMediaUrl('https://preview.replit.dev/api/admin/property-media/front.jpg', 'https://preview.replit.dev'),
    'https://preview.replit.dev/api-legacy/api/admin/property-media/front.jpg',
  );
});

test('Admin Agent photos normalize stored preview-only Laravel media paths', () => {
  assert.match(mobileManagementSource, /const mediaUrl = \(value\)/);
  assert.match(mobileManagementSource, /src="\$\{esc\(mediaUrl\(photo\)\)\}"/);
  assert.match(mobileManagementSource, /photoPreview\.src = mediaUrl\(url\)/);
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

test('Admin property filters keep status and city controls while curated pages use the sidebar', () => {
  const filterGroups = propertyManagementSource.slice(
    propertyManagementSource.indexOf('const groups = ['),
    propertyManagementSource.indexOf('for (const group of groups)'),
  );
  assert.match(filterGroups, /label: 'Status'/);
  assert.match(filterGroups, /label: 'City'/);
  assert.doesNotMatch(filterGroups, /label: '(Category|Featured|Recommended|Mobile Home)'/);
  for (const city of ['Okara', 'Depalpur', 'Renala Khurd', 'Haveli Lakha', 'Basir Pur']) {
    assert.ok(propertyManagementSource.includes(`'${city}'`), `missing ${city} city`);
  }
  assert.match(propertyManagementSource, /matchesPropertyFilters\(property\)/);
  assert.match(propertyManagementSource, /matchesPropertyFilters\(property\) && \(!propertySearch/);
  assert.match(propertyManagementSource, /row\.hidden = row\.dataset\.ogMatchesFilters !== 'true'/);
});

test('Admin includes mobile demo and project rows in the property table', () => {
  assert.match(propertyManagementSource, /addObservedProperty\(property\)/);
  assert.match(propertyManagementSource, /originalFetch\('\/admin\/demo-properties\.json'\)/);
  assert.match(propertyManagementSource, /ensureMobileDemoRows\(table\)/);
  assert.match(propertyManagementSource, /Mobile app demo/);
  assert.match(propertyManagementSource, /Mobile app project/);
  assert.match(propertyManagementSource, /request\('\/admin\/developer-projects'\)/);
  assert.match(propertyManagementSource, /request\('\/admin\/properties'\)/);
  assert.match(propertyManagementSource, /Delete demo/);
  assert.match(propertyManagementSource, /Permanently delete demo property/);
  assert.match(propertyManagementSource, /\/admin\/demo-properties\/\$\{encodeURIComponent\(property\.demoId\)\}/);
});

test('Admin can permanently delete demo properties and bundled projects from the app', () => {
  assert.match(propertyManagementSource, /\/admin\/demo-properties/);
  assert.match(propertyManagementSource, /Permanently delete demo property/);
  assert.match(propertyManagementSource, /\/admin\/demo-properties\/\$\{encodeURIComponent\(property\.demoId\)\}/);
  assert.match(mobileManagementSource, /demo-projects\.json/);
  assert.match(mobileManagementSource, /Permanently delete sample project/);
  assert.match(mobileManagementSource, /deletedDemoProjectIds/);
  assert.match(mobileManagementSource, /Delete project/);
  assert.match(mobileManagementSource, /\/admin\/demo-projects\/\$\{encodeURIComponent\(item\.id\)\}/);
  assert.match(mobileManagementSource, /fetch\('\/admin\/demo-projects\.json'\)/);
  assert.match(propertyManagementSource, /Linked blocks, units, and inventory will be preserved/);
  assert.match(propertyManagementSource, /Permanently delete .*This cannot be undone/);
  assert.match(propertyManagementSource, /data-og-delete-property/);
  assert.match(apiControllerSource, /deletedDemoProjectIds/);
  assert.match(apiControllerSource, /deletedDemoPropertyIds/);
});

test('Admin can filter and persist featured status for live mobile properties', () => {
  assert.match(propertyManagementSource, /data-og-featured-header/);
  assert.match(propertyManagementSource, /\/admin\/properties\/\$\{encodeURIComponent\(property\.id\)\}\/feature/);
  assert.match(propertyManagementSource, /JSON\.stringify\(\{ featured: nextFeatured \}\)/);
  assert.match(propertyManagementSource, /property\.isDemo \|\| property\.isProject/);
  assert.match(propertyManagementSource, /featuredFilter/);
  assert.match(mobileManagementSource, /propertyView=featured/);
  assert.match(propertyManagementSource, /isApprovedForPromotion/);
  assert.match(propertyManagementSource, /Approve this listing before featuring it/);
});

test('Admin can select and filter persistent Recommended listings for mobile Home', () => {
  assert.match(propertyManagementSource, /data-og-recommended-header/);
  assert.match(propertyManagementSource, /\/admin\/properties\/\$\{encodeURIComponent\(property\.id\)\}\/recommend/);
  assert.match(propertyManagementSource, /JSON\.stringify\(\{ recommended: nextRecommended \}\)/);
  assert.match(propertyManagementSource, /property\.isDemo \|\| property\.isProject/);
  assert.match(propertyManagementSource, /recommendedFilter/);
  assert.match(mobileManagementSource, /propertyView=recommended/);
  assert.match(propertyManagementSource, /Approve this listing before recommending it/);
  assert.match(apiRoutesSource, /\/admin\/properties\/\{id\}\/feature/);
  assert.match(apiRoutesSource, /\/admin\/properties\/\{id\}\/recommend/);
  assert.match(adminControllerSource, /in_array\(\$promotion, \['feature', 'recommend'\]/);
  assert.match(adminControllerSource, /\$property\[\$field\] = \$enabled/);
  assert.match(apiControllerSource, /\$payload\['recommended'\] = false/);
  assert.match(propertyManagementSource, /data-og-recommend-toggle/);
  assert.match(propertyManagementSource, /\+ Recommend/);
});

test('Featured and Recommended rows use saved promotion state and match server eligibility', () => {
  const rowPropertySource = propertyManagementSource.slice(
    propertyManagementSource.indexOf('function rowProperty'),
    propertyManagementSource.indexOf('function ensureStyles'),
  );
  assert.match(rowPropertySource, /\[\.\.\.apiProperties, \.\.\.properties, \.\.\.sharedProperties\]/);
  assert.ok(
    rowPropertySource.indexOf('const byId =') < rowPropertySource.indexOf('if (mediaProperty'),
    'fresh API state must take precedence over cached review-button metadata',
  );
  assert.match(propertyManagementSource, /\['active', 'approved'\]\.includes\(approval\)/);
  assert.match(propertyManagementSource, /\['active', 'approved'\]\.includes\(listing\)/);
});

test('Admin projects page provides portfolio status, inventory, search and filter controls', () => {
  assert.match(mobileManagementSource, /function renderProjects\(content, items\)/);
  assert.match(mobileManagementSource, /og-project-stats/);
  assert.match(mobileManagementSource, /Live \/ approved/);
  assert.match(mobileManagementSource, /Units available/);
  assert.match(mobileManagementSource, /data-project-search/);
  assert.match(mobileManagementSource, /data-project-status/);
  assert.match(mobileManagementSource, /No projects match these filters/);
  assert.match(mobileManagementSource, /Available, reserved and sold units cannot exceed total units/);
  assert.match(mobileManagementSource, /Project created successfully/);
  assert.match(mobileManagementSource, /projectViewState\.notice = `“\$\{label\}” archived/);
  assert.match(mobileManagementSource, /data-action="delete-record" data-section="projects"/);
  assert.match(mobileManagementSource, /Delete from app/);
});

test('Admin Agent creation saves a public mobile profile and refreshes the directory', () => {
  assert.match(mobileManagementSource, /Add mobile Agent/);
  assert.match(mobileManagementSource, /function showAgentForm\(agent = \{\}\)/);
  assert.match(mobileManagementSource, /name="name" required/);
  assert.match(mobileManagementSource, /name="visible"[^>]*checked/);
  assert.match(mobileManagementSource, /name="approvalStatus"/);
  assert.match(mobileManagementSource, /api\('\/admin\/mobile-agents', \{ method: 'POST', body: JSON\.stringify\(payload\) \}\)/);
  assert.match(mobileManagementSource, /await loadData\(\);\s*renderAgents\(modal\.querySelector\('\.og-mm-content'\)\)/);
});

test('Projects sidebar opens project management and keeps property listings separately accessible', () => {
  assert.match(mobileManagementSource, /label: 'Projects', path: '\/admin\/management\/developer-projects'/);
  assert.match(mobileManagementSource, /label: 'Project listings', path: '\/admin\/properties\?propertyView=projects'/);
  assert.match(mobileManagementSource, /section: 'projects', path: '\/admin\/management\/developer-projects'/);
  assert.match(propertyManagementSource, /data-og-project-add-action/);
  assert.match(propertyManagementSource, /\/admin\/management\/developer-projects\?create=project/);
  assert.match(mobileManagementSource, /get\('create'\) === 'project'/);
  assert.match(mobileManagementSource, /showRecordForm\('projects'\)/);
});

test('property filters use live status/city data and expose agent assignment controls', () => {
  assert.match(propertyManagementSource, /window\.__ogAdminApiProperties/);
  assert.match(propertyManagementSource, /property\?\.cityName/);
  assert.match(propertyManagementSource, /typeof location === 'object' \? location\?\.city : location/);
  assert.match(propertyManagementSource, /refreshCityFilterOptions\(root\)/);
  assert.match(propertyManagementSource, /data-og-agent-assign/);
  assert.match(propertyManagementSource, /Assign agent/);
  assert.match(propertyManagementSource, /Change agent/);
  assert.match(propertyManagementSource, /includes\(status\)/);
});

test('property filter root remains discoverable after its heading is changed', () => {
  assert.match(propertyManagementSource, /data-og-property-management-root/);
  assert.match(propertyManagementSource, /'Property listed', 'Pending approvals'/);
  assert.match(propertyManagementSource, /markedRoot\?\.isConnected/);
});

test('Admin review inbox includes new submissions and has separate Featured, Recommended, and Projects pages', () => {
  assert.match(mobileManagementSource, /label: 'Property listed', path: '\/admin\/properties\?propertyView=inbox'/);
  assert.match(mobileManagementSource, /label: 'Pending approvals', path: '\/admin\/properties\?propertyView=pending'/);
  assert.doesNotMatch(mobileManagementSource, /label: '(?:Approved|Rejected) properties'/);
  assert.match(mobileManagementSource, /label: 'Featured', path: '\/admin\/properties\?propertyView=featured'/);
  assert.match(mobileManagementSource, /label: 'Recommended', path: '\/admin\/properties\?propertyView=recommended'/);
  assert.match(mobileManagementSource, /label: 'Project listings', path: '\/admin\/properties\?propertyView=projects'/);
  assert.match(propertyManagementSource, /listingInboxView \? 'Property listed'/);
  assert.match(propertyManagementSource, /categoryFilter = agricultureView \? 'agricultural' : projectsView \? 'projects' : 'all'/);
});

test('property rows always provide a resilient review action for wrapped or unmatched titles', () => {
  assert.match(propertyManagementSource, /const normalizedRowText = \(value\) => normalize\(value\)\.replace/);
  assert.match(propertyManagementSource, /function matchPropertyToRow\(row, source = \[\]\)/);
  assert.match(propertyManagementSource, /async function resolvePropertyForRow\(row\)/);
  assert.match(propertyManagementSource, /data-og-pm-review-row/);
  assert.match(propertyManagementSource, /button\.textContent = 'Review listing'/);
});

test('property review can remove or upload photos and approve only after saving edits', () => {
  assert.match(propertyManagementSource, /data-approve-publish/);
  assert.match(propertyManagementSource, /name="photoUploads" type="file"/);
  assert.match(propertyManagementSource, /Remove listing photo/);
  const saveStart = propertyManagementSource.indexOf('async function saveProperty(event, property, container)');
  const saveEnd = propertyManagementSource.indexOf('async function deleteProperty(', saveStart);
  const save = propertyManagementSource.slice(saveStart, saveEnd);
  assert.ok(save.indexOf("await request(`/admin/properties/${encodeURIComponent(property.id)}/media`")
    < save.indexOf('if (approveAfterSave)'));
  assert.match(save, /\/properties\/\$\{encodeURIComponent\(property\.id\)\}\/approve/);
  assert.match(adminControllerSource, /'approve' => 'Active'/);
  assert.match(apiRoutesSource, /whereIn\('action', \['approve', 'reject', 'request-changes'\]\)/);
});

test('Admin separates the automatic latest six live listings from the full property table', () => {
  assert.match(propertyManagementSource, /MOBILE HOME · LATEST 6/);
  assert.match(propertyManagementSource, /data-og-latest-panel/);
  assert.match(propertyManagementSource, /Newest approved listings currently shown in the mobile app/);
  assert.match(propertyManagementSource, /isMobilePublicListing/);
  assert.match(propertyManagementSource, /createdAt/);
});

test('Admin project management supports app-shaped create/edit and safe archive flows', () => {
  assert.match(mobileManagementSource, /title: 'Developer projects', list: '\/admin\/developer-projects', createPath: '\/admin\/developer-projects'/);
  assert.match(mobileManagementSource, /\/admin\/developer-projects\/\$\{encodeURIComponent\(item\.id\)\}/);
  assert.match(mobileManagementSource, /isBundledDemo/);
  assert.match(mobileManagementSource, /demo-projects\.json/);
  assert.match(mobileManagementSource, /'name', 'Project name \*'/);
  assert.match(mobileManagementSource, /'fullDescription', 'Full project description', 'textarea'/);
  assert.match(mobileManagementSource, /'photos', 'Gallery image URLs \(one per line\)', 'textarea'/);
  assert.match(mobileManagementSource, /payload\.name = String\(payload\.name \|\| ''\)\.trim\(\)/);
  assert.match(mobileManagementSource, /payload\.title = payload\.name/);
  assert.match(mobileManagementSource, /payload\.developer = payload\.developerName/);
  assert.match(mobileManagementSource, /New projects default to Live and appear in the mobile app after saving/);
  assert.match(mobileManagementSource, /preserving linked blocks, units, and inventory/);
  assert.match(mobileManagementSource, /coverUpload/);
  assert.match(mobileManagementSource, /photoUploads/);
  assert.match(mobileManagementSource, /videoUploads/);
  assert.match(mobileManagementSource, /Current project media/);
  assert.match(mobileManagementSource, /uploadForm\.append\('context', 'project'\)/);
  assert.match(mobileManagementSource, /api\('\/upload\/multiple'/);
  assert.match(mobileManagementSource, /api\('\/upload\/video'/);
  assert.match(mobileManagementSource, /Current project media/);
  assert.match(mobileManagementSource, /data-project-upload-preview/);
  assert.match(mobileManagementSource, /data-banner-upload-preview/);
  assert.match(mobileManagementSource, /Approve “\$\{title\}” and make it publicly visible/);
  assert.match(mobileManagementSource, /\['projectMap', 'Choose location on map', 'map'\]/);
  assert.match(mobileManagementSource, /data-project-map-mode="satellite"/);
  assert.match(mobileManagementSource, /tileLayer\('https:\/\/server\.arcgisonline\.com\/ArcGIS\/rest\/services\/World_Imagery/);
  assert.match(mobileManagementSource, /map\.on\('click', \(event\) => setPin\(event\.latlng\)\)/);
  assert.match(mobileManagementSource, /marker\.on\('dragend', \(\) => setPin\(marker\.getLatLng\(\)\)\)/);
  assert.match(mobileManagementSource, /Pin the project location on the map or satellite view before creating the project/);
});

test('Agriculture Land has a separate Admin option with its own summary and category scope', () => {
  assert.match(mobileManagementSource, /label: 'Agriculture Land', path: '\/admin\/properties\?propertyView=agriculture'/);
  assert.match(propertyManagementSource, /const agricultureView = requestedView === 'agriculture'/);
  assert.match(propertyManagementSource, /categoryFilter = agricultureView \? 'agricultural' : projectsView \? 'projects' : 'all'/);
  assert.match(propertyManagementSource, /function renderAgricultureOverview\(root\)/);
  assert.match(propertyManagementSource, /Land listings|agriculture land/i);
  assert.match(propertyManagementSource, /matchesCategory\(property, 'agricultural'\)/);
});

test('Admin property table supports search, sorting, and pagination without truncating the API list', () => {
  const routeStart = serverSource.indexOf("app.get('/api/admin/properties'");
  const routeEnd = serverSource.indexOf("app.get('/api/admin/properties/:id/review'", routeStart);
  const route = serverSource.slice(routeStart, routeEnd);
  assert.match(route, /if \(req\.query\.limit !== undefined\)/);
  assert.doesNotMatch(route, /limit = '20'/);
  assert.match(propertyManagementSource, /aria-label="Search properties"/);
  assert.match(propertyManagementSource, /price-low/);
  assert.match(propertyManagementSource, /25 per page/);
  assert.match(propertyManagementSource, /data-page-summary/);
});
