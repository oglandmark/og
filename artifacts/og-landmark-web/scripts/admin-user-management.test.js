const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'public/admin/admin-user-management.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'public/admin/index.html'), 'utf8');

test('Admin Users loads the live user-management enhancement', () => {
  assert.match(index, /admin-user-management\.js\?v=/);
  assert.match(page, /request\('\/api\/users'\)/);
  assert.match(page, /localStorage\.getItem\('og_token'\)/);
  assert.match(page, /Authorization: `Bearer \$\{token\}`/);
  assert.match(page, /\['Buyer', 'Users \/ Buyers'\]/);
  assert.match(page, /Mobile app registrations appear under Users \/ Buyers and refresh automatically/);
  assert.match(index, /admin-user-management\.js\?v=mobile-users-auth-20261029/);
  assert.match(page, /\['Seller', 'Sellers'\]/);
  assert.match(page, /\['Agent', 'Agents'\]/);
  assert.match(page, /\['Admin', 'Admins'\]/);
});

test('Admin Users exposes profile, activity, edit, and reversible status actions', () => {
  assert.match(page, /\/api\/admin\/users\/\$\{encodeURIComponent\(user\.id\)\}\/activity/);
  assert.match(page, /\/api\/admin\/properties/);
  assert.match(page, /method: 'PUT', body: JSON\.stringify\(values\)/);
  assert.match(page, /data-status="Suspended"/);
  assert.match(page, /data-status="Inactive"/);
  assert.match(page, /data-status="Active"/);
  assert.match(page, /window\.confirm/);
});
