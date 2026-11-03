const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'public/user/index.html'), 'utf8');
const portal = fs.readFileSync(path.join(root, 'public/user/portal.js'), 'utf8');
const server = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const mobileApi = fs.readFileSync(path.resolve(root, '../og-landmark-mobile/lib/api.ts'), 'utf8');

test('website account portal includes the mobile Agent directory filters', () => {
  assert.match(html, /data-page="agents"/);
  assert.match(html, /id="page-agents"/);
  assert.match(html, /id="agent-search"/);
  assert.match(html, /id="agent-specialty"/);
  assert.match(html, /id="agent-area"/);
  assert.match(html, /id="agent-experience"/);
  assert.match(portal, /load\('agents', '\/api\/mobile-agents'/);
  assert.match(portal, /data-agent|agent-card-actions/);
  assert.match(mobileApi, /`\/api\/mobile-agents/);
});

test('public mobile Agent API excludes inactive, unapproved, and hidden records', () => {
  const start = server.indexOf("app.get('/api/mobile-agents'");
  const end = server.indexOf("app.get('/api/admin/mobile-agents'", start);
  assert.ok(start >= 0 && end > start, 'public mobile Agent route should exist');
  const route = server.slice(start, end);
  assert.match(route, /a\.visible !== false/);
  assert.match(route, /a\.status \|\| ''\)\.toLowerCase\(\) === 'active'/);
  assert.match(route, /a\.approvalStatus \|\| ''\)\.toLowerCase\(\) === 'approved'/);
});

test('website My Listings uses account-scoped data and supports mobile lifecycle actions', () => {
  assert.match(portal, /load\('listings', '\/api\/my-properties'/);
  assert.match(portal, /data-listing-status="Paused"/);
  assert.match(portal, /data-resubmit-listing/);
  assert.match(portal, /data-delete-listing/);
  assert.match(portal, /\/listing-status`/);
  assert.match(portal, /\/resubmit`/);
});

test('website account identity is refreshed from the authenticated API and logout revokes its session', () => {
  assert.match(portal, /load\('account', '\/api\/account'/);
  assert.match(portal, /syncIdentity\(state\.account\)/);
  assert.match(portal, /\/api\/auth\/logout/);
  assert.match(portal, /finally\s*\{[\s\S]*?removeItem\('og_token'\)/);
});

test('profile and appointments are backed by account APIs instead of fixed example records', () => {
  assert.match(html, /id="profile-edit-form"|id="profile-panel"/);
  assert.match(html, /id="appointment-request-form"/);
  assert.match(portal, /api\('\/api\/appointments'/);
  assert.match(portal, /data-cancel-appointment/);
  assert.match(portal, /This section will display your files once private account storage is connected/);
  assert.doesNotMatch(portal, /CNIC_Front\.jpg|Bank_Statement_Jan\.pdf|Usman Ahmed/);
});

test('property cards open the website listing route and saved IDs accept API object shapes', () => {
  assert.match(portal, /href="\/properties\/\$\{encodeURIComponent\(propertyId\)\}"/);
  assert.match(portal, /entry\.property_id \?\? entry\.propertyId \?\? entry\.id/);
});
