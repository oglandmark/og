'use strict';

const STAFF_PERMISSIONS = ['admin', 'agent', 'developer'];

function getUserPermissions(user = {}) {
  const permissions = Array.isArray(user.permissions)
    ? user.permissions.map(permission => String(permission).trim().toLowerCase())
      .filter(permission => STAFF_PERMISSIONS.includes(permission))
    : [];
  const role = String(user.role || '').trim().toLowerCase();
  if (STAFF_PERMISSIONS.includes(role)) permissions.push(role);
  return [...new Set(permissions)];
}

function resolveAuthenticatedUser(user) {
  const sourceRole = String(user.role || 'User').trim() || 'User';
  const permissions = getUserPermissions(user);
  const effectiveStaffRole = STAFF_PERMISSIONS.find(permission => permissions.includes(permission));
  const role = effectiveStaffRole
    ? effectiveStaffRole[0].toUpperCase() + effectiveStaffRole.slice(1)
    : sourceRole;

  return { ...user, role, permissions, _sourceRole: sourceRole };
}

function toPublicUser(user) {
  const {
    password,
    _sourceRole,
    ...safeUser
  } = user;
  const sourceRole = String(_sourceRole || user.role || 'User').trim();
  const normalizedSourceRole = sourceRole.toLowerCase();

  safeUser.accountType = 'User';
  safeUser.permissions = getUserPermissions({ ...user, role: sourceRole });
  safeUser.role = ['buyer', 'seller', 'user'].includes(normalizedSourceRole)
    ? 'User'
    : sourceRole;
  return safeUser;
}

function hasPermission(user, permission) {
  return getUserPermissions(user).includes(String(permission || '').trim().toLowerCase());
}

module.exports = {
  getUserPermissions,
  hasPermission,
  resolveAuthenticatedUser,
  toPublicUser,
};
