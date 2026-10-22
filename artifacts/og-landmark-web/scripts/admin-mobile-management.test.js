const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const mobileRoot = path.resolve(root, '..', 'og-landmark-mobile');

function readBundledDemos() {
  const source = fs.readFileSync(path.join(mobileRoot, 'lib/properties.ts'), 'utf8');
  const declaration = source.indexOf('const bundledDemoProperties: Property[] = [');
  assert.notEqual(declaration, -1, 'bundled demo source should remain discoverable');
  const end = source.indexOf('\n];', declaration) + 2;
  assert.ok(end > declaration, 'bundled demo array should be closed');
  const literal = source.slice(source.indexOf('[', declaration), end).replace(
    /require\((['"])(.*?)\1\)(?:\s+as\s+unknown\s+as\s+number)?/g,
    (_match, _quote, assetPath) => JSON.stringify(assetPath),
  );
  return vm.runInNewContext(literal, {});
}

test('admin mobile demo catalog mirrors the bundled mobile demo records', () => {
  const catalog = JSON.parse(fs.readFileSync(path.join(root, 'public/admin/demo-properties.json'), 'utf8'));
  const bundled = readBundledDemos();
  const fields = ['id', 'title', 'type', 'status', 'price', 'area', 'areaUnit', 'city', 'address', 'agent'];

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

test('mobile management module is loaded by the existing website admin', () => {
  const html = fs.readFileSync(path.join(root, 'public/admin/index.html'), 'utf8');
  assert.match(html, /admin-mobile-management\.js/);
  assert.match(html, /window\.__OG_API_BASE__\s*=\s*'\/admin-live-api'/);
  assert.match(html, /replit\\\.dev\|replit\\\.app\|repl\\\.co/);
});

test('live mobile manager uses the production-backed API collections requested', () => {
  const source = fs.readFileSync(path.join(root, 'public/admin/admin-mobile-management.js'), 'utf8');
  for (const endpoint of [
    '/admin/properties',
    '/admin/mobile-agents',
    '/users',
    '/mobile/banners/all',
    '/admin/announcements',
  ]) assert.ok(source.includes(endpoint), `expected API endpoint ${endpoint}`);
  assert.match(source, /Permanently delete account/);
  assert.match(source, /Send this notification to the selected live users now/);
  assert.match(source, /\/admin\/announcements\/\$\{encodeURIComponent\(id\)\}\/send/);
});
