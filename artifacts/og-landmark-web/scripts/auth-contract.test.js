'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  getUserPermissions,
  hasPermission,
  resolveAuthenticatedUser,
  toPublicUser,
} = require('./auth-contract');

test('legacy Buyer and Seller profiles serialize as User accounts without staff access', () => {
  for (const role of ['Buyer', 'Seller']) {
    const user = { id: 4, role, password: 'must-not-leak' };
    const publicUser = toPublicUser(user);

    assert.equal(publicUser.role, 'User');
    assert.equal(publicUser.accountType, 'User');
    assert.deepEqual(publicUser.permissions, []);
    assert.equal('password' in publicUser, false);
  }
});

test('legacy staff roles are retained as explicit permissions in the public account contract', () => {
  for (const permission of ['admin', 'agent', 'developer']) {
    const role = permission[0].toUpperCase() + permission.slice(1);
    const publicUser = toPublicUser({ id: 8, role });

    assert.equal(publicUser.role, role);
    assert.equal(publicUser.accountType, 'User');
    assert.deepEqual(publicUser.permissions, [permission]);
    assert.equal(hasPermission({ role }, permission), true);
  }
});

test('stored staff permissions authorize server requests but do not change a User public role', () => {
  const storedUser = { id: 9, role: 'User', permissions: ['ADMIN', 'unrecognized'] };
  const authenticated = resolveAuthenticatedUser(storedUser);
  const publicUser = toPublicUser(authenticated);

  assert.equal(authenticated.role, 'Admin');
  assert.deepEqual(getUserPermissions(authenticated), ['admin']);
  assert.equal(publicUser.role, 'User');
  assert.equal(publicUser.accountType, 'User');
  assert.deepEqual(publicUser.permissions, ['admin']);
});
