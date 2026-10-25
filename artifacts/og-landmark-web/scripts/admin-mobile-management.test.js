const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {
  assertCatalogMatches,
  buildAdminCatalog,
  checkCatalog,
  readBundledDemos,
} = require('./sync-admin-demo-properties');

const root = path.resolve(__dirname, '..');

test('admin mobile demo catalog mirrors the bundled mobile demo records', () => {
  const catalog = JSON.parse(fs.readFileSync(path.join(root, 'public/admin/demo-properties.json'), 'utf8'));
  const bundled = readBundledDemos();
  const generated = buildAdminCatalog();

  assert.deepEqual(catalog, generated, 'admin catalog should be generated from the mobile records');
  assert.equal(catalog.length, bundled.length);
  assert.equal(new Set(catalog.map((item) => item.id)).size, catalog.length, 'demo IDs must be unique');
  for (const property of bundled) {
    const adminRecord = catalog.find((item) => item.id === property.id);
    assert.ok(adminRecord, `admin catalog should include bundled property ${property.id}`);
  }
});

test('detects stale generated admin demo catalog records', () => {
  const expected = buildAdminCatalog();
  const stale = structuredClone(expected);
  stale[0].price += 1;
  const temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'admin-demo-catalog-'));
  const staleCatalogPath = path.join(temporaryDirectory, 'demo-properties.json');

  try {
    fs.writeFileSync(staleCatalogPath, JSON.stringify(stale));
    assert.throws(
      () => checkCatalog(staleCatalogPath),
      /Admin demo catalog is out of sync.*changed records: 1.*sync:admin-demos/,
    );
    assert.throws(
      () => assertCatalogMatches(stale, expected),
      /Admin demo catalog is out of sync.*changed records: 1.*sync:admin-demos/,
    );
  } finally {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
});

test('mobile management module is loaded by the existing website admin', () => {
  const html = fs.readFileSync(path.join(root, 'public/admin/index.html'), 'utf8');
  const script = fs.readFileSync(path.join(root, 'public/admin/admin-dashboard-polish.js'), 'utf8');
  const styles = fs.readFileSync(path.join(root, 'public/admin/admin-dashboard-polish.css'), 'utf8');

  assert.match(html, /admin-mobile-management\.js\?v=[^"]+/);
  assert.match(script, /aria-label', 'Open navigation'/);
  assert.match(script, /aria-controls/);
  assert.match(script, /aria-expanded/);
  assert.match(script, /event\.key === 'Escape'/);
  assert.match(script, /root\.classList\.add\('og-admin-shell'\)/);
  assert.match(styles, /^#root\.og-admin-shell aside \{/m);
  assert.match(styles, /^#root\.og-admin-shell aside \+ div \{/m);
  assert.doesNotMatch(styles, /^#root\.og-admin-dashboard aside \{/m);
  assert.match(styles, /@media \(max-width: 900px\)/);
  assert.match(styles, /og-admin-shell\.og-mobile-nav-open aside/);
  assert.match(styles, /og-admin-nav-overlay/);
  assert.match(html, /admin-dashboard-polish\.css\?v=stable-admin-menu-20261022/);
});

test('main dashboard adds real management shortcuts above the existing data-backed overview', () => {
  const script = fs.readFileSync(path.join(root, 'public/admin/admin-dashboard-polish.js'), 'utf8');
  const styles = fs.readFileSync(path.join(root, 'public/admin/admin-dashboard-polish.css'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'public/admin/index.html'), 'utf8');

  assert.match(script, /aria-label', 'Open navigation'/);
  assert.match(script, /aria-controls/);
  assert.match(script, /aria-expanded/);
  assert.match(script, /event\.key === 'Escape'/);
  assert.match(styles, /@media \(max-width: 900px\)/);
  assert.match(styles, /og-admin-shell\.og-mobile-nav-open aside/);
  assert.match(styles, /og-admin-nav-overlay/);
  assert.match(html, /admin-dashboard-polish\.css\?v=stable-admin-menu-20261022/);
});

test('admin banner editor can replace uploaded images and videos and confirm deletion', () => {
  const source = fs.readFileSync(path.join(root, 'public/admin/admin-mobile-management.js'), 'utf8');
  assert.match(source, /Current \$\{item\.type === 'video' \? 'video' : 'image'\}/);
  assert.match(source, /Replace media file \(optional\)/);
  assert.match(source, /item\.type === 'video' \? '\.mp4,\.mov' : '\.jpg,\.jpeg,\.png,\.webp'/);
  assert.match(source, /formData\.append\('_method', 'PUT'\)/);
  assert.match(source, /key === 'banners' && bannerFile \? 'POST' : 'PUT'/);
  assert.match(source, /\['startDate', 'Campaign start date \(optional\)', 'date'\]/);
  assert.match(source, /\['endDate', 'Campaign end date \(optional\)', 'date'\]/);
  assert.match(source, /End date must be the same as or later than the start date\./);
  assert.match(source, /item\.startDate && item\.startDate > today[\s\S]*?'Upcoming'/);
  assert.match(source, /item\.endDate && item\.endDate < today[\s\S]*?'Expired'/);
  assert.match(source, /Permanently delete the \$\{item\.type === 'video' \? 'video' : 'image'\} banner/);
});

test('Admin navigation keeps core destinations and exposes current property views', () => {
  const source = fs.readFileSync(path.join(root, 'public/admin/admin-mobile-management.js'), 'utf8');
  const navBlock = source.match(/const sidebarItems = \[([\s\S]*?)\n  \];/)?.[1] || '';
  const destinations = [
    'Main', 'Property listed', 'Pending approvals', 'Approved properties', 'Rejected properties',
    'Featured', 'Recommended', 'Projects', 'Project listings', 'Agriculture Land', 'User management', 'Agent Management',
    'App banners management', 'App notifications management',
  ];
  assert.equal((navBlock.match(/\{ label:/g) || []).length, destinations.length, 'sidebar destinations should match its configured navigation');
  for (const item of destinations) assert.ok(navBlock.includes(`label: '${item}'`), `sidebar should include ${item}`);
  assert.doesNotMatch(navBlock, /Property in progress|Property closed/);
  assert.match(source, /for \(const item of sidebarItems\)/);
  assert.match(source, /function attachNavigation\(\)\s*\{\s*const nav = document\.querySelector\('aside nav'\);\s*if \(!nav\) return;\s*installStyles\(\);/);
  assert.doesNotMatch(navBlock, /Projects Management|Leads & Inquiries|Locations Management|Staff & Permissions|System Settings/);
  assert.match(source, /data-og-admin-nav/);
  assert.match(source, /const iconPaths = \{/);
  assert.match(source, /og-mm-nav-icon/);
  assert.match(source, /caption\.textContent = label/);
  assert.match(source, /\.og-mm-nav-link\.active/);
  assert.match(source, /\.og-mm-nav-link:focus-visible/);
  assert.doesNotMatch(source, /createElement\('details'\)/);
  assert.match(source, /function sectionFromPath\(\)/);
  assert.doesNotMatch(source, /Demo properties/);
  assert.doesNotMatch(source, /Manage mobile app/);
  assert.doesNotMatch(source, /og-mm-tabs/);
});

test('new Admin projects default to mobile-visible Live status', () => {
  const source = fs.readFileSync(path.join(root, 'public/admin/admin-mobile-management.js'), 'utf8');
  assert.match(source, /New projects default to Live and appear in the mobile app after saving/);
  assert.match(source, /if \(key === 'projects' && name === 'status' && !value\) value = editing \? 'Draft' : 'Live';/);
});

test('mobile management pages use the existing Admin shell instead of a second fixed dashboard', () => {
  const source = fs.readFileSync(path.join(root, 'public/admin/admin-mobile-management.js'), 'utf8');
  const styles = fs.readFileSync(path.join(root, 'public/admin/admin-dashboard-polish.css'), 'utf8');
  assert.match(source, /pageHost = document\.querySelector\('#root main'\)/);
  assert.match(source, /pageHost\.appendChild\(modal\)/);
  assert.match(source, /hiddenMainChildren\.forEach/);
  assert.match(source, /setAdminPageTitle\(activeSection\.label\)/);
  assert.doesNotMatch(source, /document\.body\.appendChild\(modal\)/);
  assert.match(source, /\.og-mm-page\{width:100%;min-height:/);
  assert.match(styles, /#root\.og-admin-content-page header h1::after/);
});

test('Admin sidebar keeps the property inbox shortcut while status filters remain available', () => {
  const navigation = fs.readFileSync(path.join(root, 'public/admin/admin-mobile-management.js'), 'utf8');
  const properties = fs.readFileSync(path.join(root, 'public/admin/admin-property-management.js'), 'utf8');
  const navBlock = navigation.match(/const sidebarItems = \[([\s\S]*?)\n  \];/)?.[1] || '';
  assert.match(navBlock, /propertyView=inbox/);
  assert.doesNotMatch(navBlock, /propertyView=in-progress|propertyView=closed/);
  assert.match(properties, /new URLSearchParams\(window\.location\.search\)\.get\('propertyView'\)/);
  assert.match(properties, /value === 'listed'/);
  assert.match(properties, /value === 'in-progress'/);
  assert.match(properties, /value === 'closed'/);
  assert.match(properties, /if \(value === 'all'\) return true/);
  assert.match(properties, /row\.dataset\.ogMatchesFilters = String\(matchesPropertyFilters\(property\)/);
});

test('admin dashboard has an accessible off-canvas navigation on tablet and mobile', () => {
  const script = fs.readFileSync(path.join(root, 'public/admin/admin-dashboard-polish.js'), 'utf8');
  const styles = fs.readFileSync(path.join(root, 'public/admin/admin-dashboard-polish.css'), 'utf8');
  const html = fs.readFileSync(path.join(root, 'public/admin/index.html'), 'utf8');

  assert.match(script, /aria-label', 'Open navigation'/);
  assert.match(script, /aria-controls/);
  assert.match(script, /aria-expanded/);
  assert.match(script, /event\.key === 'Escape'/);
  assert.match(styles, /@media \(max-width: 900px\)/);
  assert.match(styles, /og-admin-shell\.og-mobile-nav-open aside/);
  assert.match(styles, /og-admin-nav-overlay/);
  assert.match(html, /admin-dashboard-polish\.css\?v=stable-admin-menu-20261022/);
});

test('admin banner editor can replace uploaded images and videos and confirm deletion', () => {
  const source = fs.readFileSync(path.join(root, 'public/admin/admin-mobile-management.js'), 'utf8');
  assert.match(source, /Current \$\{item\.type === 'video' \? 'video' : 'image'\}/);
  assert.match(source, /Replace media file \(optional\)/);
  assert.match(source, /item\.type === 'video' \? '\.mp4,\.mov' : '\.jpg,\.jpeg,\.png,\.webp'/);
  assert.match(source, /formData\.append\('_method', 'PUT'\)/);
  assert.match(source, /key === 'banners' && bannerFile \? 'POST' : 'PUT'/);
  assert.match(source, /Permanently delete the \$\{item\.type === 'video' \? 'video' : 'image'\} banner/);
});

test('Agent table shows profile thumbnails with bounded missing and broken-photo states', () => {
  const source = fs.readFileSync(path.join(root, 'public/admin/admin-mobile-management.js'), 'utf8');
  assert.match(source, /const photo = agent\.photo \|\| agent\.profilePhoto/);
  assert.match(source, /data-agent-list-photo src="\$\{esc\(photo\)\}"/);
  assert.match(source, /og-mm-agent-list-photo og-mm-agent-list-photo-fallback">No photo/);
  assert.match(source, /data-agent-photo-fallback hidden>Photo unavailable/);
  assert.match(source, /image\.addEventListener\('error', \(\) => \{\s*image\.hidden = true;/);
  assert.match(source, /\.og-mm-agent-list-photo\{[^}]*width:40px;height:40px;overflow:hidden/);
  assert.match(source, /<th>Photo<\/th><th>Agent<\/th>/);
  assert.match(source, /data-remove-agent-photo/);
  assert.doesNotMatch(source, /Profile photo URL/);
  assert.match(source, /let photoUrl = String\(agent\.photo \|\| agent\.profilePhoto \|\| ''\)\.trim\(\)/);
  assert.match(source, /Photo selected\. Save Agent to upload and apply it\./);
  assert.match(source, /if \(selectedPhotoFile\) \{\s*photoStatus\.className = 'og-mm-agent-photo-status';\s*photoStatus\.textContent = 'Uploading photo and saving profile…';\s*const formData = new FormData\(\);\s*formData\.append\('image', selectedPhotoFile\)/);
  assert.match(source, /const uploaded = await api\('\/upload\/single'/);
  assert.match(source, /photo: photoUrl \|\| null/);
  assert.match(source, /profilePhoto: photoUrl \|\| null/);
  assert.match(source, /name="rating" type="number"/);
  assert.match(source, /name="reviewCount" type="number"/);
  assert.match(source, /name="listings" type="number"/);
  assert.match(source, /name="verified" \$\{agent\.verified !== false \? 'checked' : ''\}/);
  assert.match(source, /data-action="delete-agent"/);
  assert.match(source, /showAgentForm\(agent\)/);
  assert.match(source, /readAgentSource\('\/admin\/city-agents'/);
  assert.match(source, /readAgentSource\('\/admin\/mobile-agents'/);
  assert.match(source, /readAgentSource\('\/admin\/users\?role=agent'/);
  assert.match(source, /api\('\/admin\/mobile-agents', \{ method: 'POST'/);
  assert.match(source, /record\.role \|\| ''\)\.toLowerCase\(\) === 'agent'/);
  assert.match(source, /phone-name:\$\{normalizedPhone\}:\$\{nameKey\}/);
  assert.match(source, /Showing \$\{agents\.length\} unique Agents/);
  assert.match(source, /Manage in Users/);
  assert.match(source, /Some Agent sources could not be loaded/);
  assert.match(source, /directorySources\.push/);
});

test('property table supports eligible batch approval and per-listing results', () => {
  const source = fs.readFileSync(path.join(root, 'public/admin/admin-property-management.js'), 'utf8');
  assert.match(source, /isBulkReviewEligible/);
  assert.match(source, /data-og-review-select/);
  assert.match(source, /select up to 100 eligible listings/);
  assert.match(source, /Approve selected/);
  assert.match(source, /Reject selected/);
  assert.match(source, /window\.confirm\(`\$\{label\} \$\{ids\.length\} selected listings/);
  assert.match(source, /request\('\/admin\/properties\/bulk-review'/);
  assert.match(source, /results\.map\(\(item\) => `\$\{item\.title \|\| `Listing \$\{item\.id\}`\}/);
});

test('property review history supports batch selection, rejection notes, and outcome reporting', () => {
  const source = fs.readFileSync(path.join(root, 'public/admin/admin-mobile-management.js'), 'utf8');
  assert.match(source, /data-review-bulk-select/);
  assert.match(source, /isReviewEligible/);
  assert.match(source, /data-action="bulk-review-properties"/);
  assert.match(source, /window\.confirm\(`\$\{label\} \$\{ids\.length\} selected listings/);
  assert.match(source, /Optional reason for rejecting these listings/);
  assert.match(source, /api\('\/admin\/properties\/bulk-review'/);
  assert.match(source, /results\.map\(\(item\) => `\$\{item\.title \|\| `Listing \$\{item\.id\}`\}/);
});
