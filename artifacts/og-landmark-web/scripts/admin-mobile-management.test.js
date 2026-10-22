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
  const fields = ['id', 'title', 'type', 'status', 'price', 'area', 'areaUnit', 'city', 'address', 'agent'];

  assert.deepEqual(catalog, generated, 'admin catalog should be generated from the mobile records');
  assert.equal(catalog.length, bundled.length);
  assert.equal(new Set(catalog.map((item) => item.id)).size, catalog.length, 'demo IDs must be unique');
  for (const property of bundled) {
    const adminRecord = catalog.find((item) => item.id === property.id);
    assert.ok(adminRecord, `admin catalog should include demo ${property.id}`);
    for (const field of fields) assert.equal(adminRecord[field], property[field], `demo ${property.id} ${field}`);
    assert.equal(adminRecord.phone, property.agentPhone || '');
    assert.equal(adminRecord.featured, Boolean(property.featured));
  }
});

test('admin demo catalog check reports stale records clearly', () => {
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
  assert.match(html, /admin-mobile-management\.js/);
  assert.match(html, /window\.__OG_API_BASE__\s*=\s*'\/api'/);
  assert.match(html, /replit\\\.dev\|replit\\\.app\|repl\\\.co/);
  assert.doesNotMatch(html, /admin-live-api/);
});

test('mobile manager uses the existing API collections requested', () => {
  const source = fs.readFileSync(path.join(root, 'public/admin/admin-mobile-management.js'), 'utf8');
  assert.match(source, /name="photoUpload" type="file" accept="[^"]*image\/jpeg[^"]*image\/png[^"]*image\/webp/);
  assert.match(source, /formData\.append\('image', file\)/);
  assert.match(source, /api\('\/upload\/single', \{ method: 'POST', body: formData \}\)/);
  assert.match(source, /if \(typeof uploaded\?\.url !== 'string' \|\| !uploaded\.url\.trim\(\)\)/);
  assert.match(source, /photoUrlInput\.value = uploaded\.url\.trim\(\)/);
  assert.match(source, /catch \(error\) \{\s*showPhotoPreview\(previousPhotoUrl\)/);
  assert.match(source, /photoUploadInProgress/);
});

test('Admin sidebar contains only the eight requested destinations', () => {
  const source = fs.readFileSync(path.join(root, 'public/admin/admin-mobile-management.js'), 'utf8');
  const navBlock = source.match(/const sidebarItems = \[([\s\S]*?)\n  \];/)?.[1] || '';
  const destinations = ['Main', 'Property listed', 'Property in progress', 'Property closed', 'User management', 'Agent Management', 'App banners management', 'App notifications management'];
  assert.equal((navBlock.match(/\{ label:/g) || []).length, destinations.length, 'sidebar should contain only eight links');
  for (const item of destinations) assert.ok(navBlock.includes(`label: '${item}'`), `sidebar should include ${item}`);
  assert.doesNotMatch(navBlock, /Projects Management|Leads & Inquiries|Locations Management|Staff & Permissions|System Settings/);
  assert.match(source, /data-og-admin-nav/);
  assert.doesNotMatch(source, /createElement\('details'\)/);
  assert.match(source, /function sectionFromPath\(\)/);
  assert.doesNotMatch(source, /Demo properties/);
  assert.doesNotMatch(source, /Manage mobile app/);
  assert.doesNotMatch(source, /og-mm-tabs/);
});

test('property menu destinations open the corresponding live status filters', () => {
  const navigation = fs.readFileSync(path.join(root, 'public/admin/admin-mobile-management.js'), 'utf8');
  const properties = fs.readFileSync(path.join(root, 'public/admin/admin-property-management.js'), 'utf8');
  assert.match(navigation, /propertyView=listed/);
  assert.match(navigation, /propertyView=in-progress/);
  assert.match(navigation, /propertyView=closed/);
  assert.match(properties, /new URLSearchParams\(window\.location\.search\)\.get\('propertyView'\)/);
  assert.match(properties, /value === 'listed'/);
  assert.match(properties, /value === 'in-progress'/);
  assert.match(properties, /value === 'closed'/);
  assert.match(properties, /if \(value === 'all'\) return true/);
  assert.match(properties, /row\.hidden = !matchesFilter\(property, filter\)/);
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
  assert.match(html, /admin-dashboard-polish\.css\?v=20261022-mobile-nav/);
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
  assert.match(source, /api\('\/admin\/city-agents'\)[\s\S]*api\('\/admin\/mobile-agents'\)/);
  assert.match(source, /directorySources\.push/);
});
