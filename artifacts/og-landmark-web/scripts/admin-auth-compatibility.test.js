'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const {
  apiBase,
  clearSession,
  endpoints,
  extractUser,
  isAdminUser,
  loginRequest,
  otpRequest,
  persistSession,
  requiresOtp,
} = require('../public/admin/admin-auth-compatibility.js');

const htmlPath = path.join(__dirname, '..', 'public', 'admin', 'index.html');
const managementPath = path.join(__dirname, '..', 'public', 'admin', 'admin-property-management.js');

function memoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
    values,
  };
}

test('admin auth routes follow the same configured API base as the website', () => {
  const windowRef = { __OG_API_BASE__: '/api-proxy/' };
  assert.equal(apiBase(windowRef), '/api-proxy');
  assert.deepEqual(endpoints(windowRef), {
    verify: '/api-proxy/auth/admin-verify',
    otp: '/api-proxy/auth/admin-otp',
    me: '/api-proxy/auth/me',
  });
});

test('admin login and OTP requests match Laravel input fields and OTP response contract', () => {
  assert.deepEqual(loginRequest('  ADMIN@example.test ', ' secret '), {
    email: 'ADMIN@example.test',
    password: ' secret ',
  });
  assert.deepEqual(otpRequest(' ADMIN@example.test ', ' 123456 '), {
    email: 'admin@example.test',
    otp: '123456',
  });
  assert.deepEqual(otpRequest(' ADMIN@example.test ', ' 123456 ', true), {
    email: 'admin@example.test',
    otp: '123456',
    rememberDevice: true,
  });
  assert.equal(requiresOtp({ success: true, message: 'Verification code sent.' }), true);
  assert.equal(requiresOtp({ success: true, user: { role: 'Admin' }, token: 'session' }), false);
  assert.equal(requiresOtp({ error: 'Invalid admin credentials.' }), false);
});

test('admin session recovery accepts both direct and Laravel-wrapped current-user responses', () => {
  const user = { id: 7, role: 'Admin' };
  assert.deepEqual(extractUser(user), user);
  assert.deepEqual(extractUser({ user }), user);
  assert.equal(isAdminUser(extractUser({ user })), true);
});

test('delegated admin login submit reads its form from the event target', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'public', 'admin', 'admin-auth-compatibility.js'),
    'utf8',
  );
  const beginSignIn = source.match(/async function beginSignIn\(event\) \{([\s\S]*?)\n    \}/)?.[1] ?? '';

  assert.match(beginSignIn, /const form = event\.target;/);
  assert.doesNotMatch(beginSignIn, /event\.currentTarget/);
});

test('only admin sessions are persisted and logout recovery clears all dashboard auth keys', () => {
  const storage = memoryStorage();
  assert.equal(persistSession(storage, 'buyer-token', { role: 'User' }), false);
  assert.equal(storage.getItem('og_token'), null);

  assert.equal(persistSession(storage, 'admin-token', { id: 3, role: 'Admin' }), true);
  assert.equal(storage.getItem('og_token'), 'admin-token');
  assert.deepEqual(JSON.parse(storage.getItem('og_user')), { id: 3, role: 'Admin' });
  assert.equal(storage.getItem('adminAuth'), 'true');
  assert.equal(isAdminUser({ role: 'admin' }), true);
  assert.equal(isAdminUser({ role: 'User', permissions: ['admin'] }), false);

  clearSession(storage);
  assert.equal(storage.getItem('og_token'), null);
  assert.equal(storage.getItem('og_user'), null);
  assert.equal(storage.getItem('adminAuth'), null);
});

test('admin page loads the OTP/session bridge before the compiled dashboard and sends profile IDs as strings', () => {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const management = fs.readFileSync(managementPath, 'utf8');
  const bridgeIndex = html.indexOf('/admin/admin-auth-compatibility.js');
  const bundleIndex = html.indexOf('/admin/assets/admin-');

  assert.notEqual(bridgeIndex, -1);
  assert.ok(bridgeIndex < bundleIndex, 'auth compatibility must mount before the dashboard');
  assert.match(management, /id:\s*profile\s*\?\s*String\(profile\.id\)\s*:\s*null/);
});
