'use strict';

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const webDirectory = path.resolve(__dirname, '..');
const password = 'LegacyAccount123';

function fixtureUser(id, role, overrides = {}) {
  const salt = `auth-compatibility-${id}`;
  const hash = require('node:crypto')
    .pbkdf2Sync(password, salt, 100000, 64, 'sha512')
    .toString('hex');
  return {
    id,
    name: `${role} Fixture`,
    email: `${role.toLowerCase()}-${id}@example.test`,
    phone: `03001234${String(id).padStart(3, '0')}`,
    role,
    status: 'Active',
    password: `pbkdf2:${salt}:${hash}`,
    ...overrides,
  };
}

async function reservePort() {
  const listener = net.createServer();
  listener.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    listener.once('listening', resolve);
    listener.once('error', reject);
  });
  const { port } = listener.address();
  await new Promise((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
  return port;
}

async function jsonRequest(baseUrl, route, { token, ...options } = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${baseUrl}${route}`, {
    ...options,
    headers,
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });
  const text = await response.text();
  return { response, body: text ? JSON.parse(text) : null };
}

test('legacy login, current-user, registration, and staff permissions share one contract', {
  timeout: 30000,
}, async t => {
  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'og-auth-compatibility-'));
  const dataFile = path.join(temporaryDirectory, 'runtime-data.json');
  const fixture = {
    users: [
      fixtureUser(41, 'Buyer'),
      fixtureUser(42, 'Seller'),
      fixtureUser(43, 'Admin'),
      fixtureUser(44, 'Agent', { approvalStatus: 'Approved' }),
      fixtureUser(45, 'Developer'),
      fixtureUser(46, 'User', { permissions: ['admin'] }),
      fixtureUser(47, 'User', { permissions: ['agent'], approvalStatus: 'Pending' }),
    ],
    properties: [{
      id: 1005,
      title: 'Visible Fixture Listing',
      type: 'House',
      purpose: 'For Sale',
      status: 'For Sale',
      price: 25000000,
      city: 'Lahore',
      address: 'Test Street',
      bedrooms: 3,
      bathrooms: 2,
      area: 2400,
      areaUnit: 'sqft',
      description: 'A test listing for the property detail route.',
      images: [],
      approvalStatus: 'Active',
      listingStatus: 'Active',
      createdAt: '2026-11-03T00:00:00.000Z',
    }],
    appointments: [
      { id: 701, buyerId: 41, propertyTitle: 'Buyer-owned appointment', status: 'Upcoming', date: '2026-12-01' },
      { id: 702, buyerId: 42, propertyTitle: 'Other account appointment', status: 'Upcoming', date: '2026-12-02' },
    ],
    nextId: 1000,
  };
  await fs.writeFile(dataFile, JSON.stringify(fixture), { mode: 0o600 });

  const port = await reservePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  let output = '';
  const child = spawn(process.execPath, ['server.js'], {
    cwd: webDirectory,
    env: {
      ...process.env,
      NODE_ENV: 'development',
      REPLIT_ENVIRONMENT: 'auth-compatibility-e2e',
      REPLIT_DEV_DOMAIN: '',
      PORT: String(port),
      DATABASE_URL: '',
      OG_LANDMARK_RUNTIME_DATA: dataFile,
      LARAVEL_API_URL: '',
      LARAVEL_API_PREVIEW_URL: '',
      LARAVEL_WEB_URL: '',
      SMTP_USER: '',
      SMTP_PASS: '',
      MAIL_USERNAME: '',
      MAIL_USER: '',
      MAIL_PASSWORD: '',
      FROM_EMAIL: '',
      MAIL_FROM_ADDRESS: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  for (const stream of [child.stdout, child.stderr]) {
    stream.on('data', chunk => { output = `${output}${chunk.toString()}`.slice(-8000); });
  }

  t.after(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill('SIGTERM');
      await Promise.race([
        new Promise(resolve => child.once('exit', resolve)),
        new Promise(resolve => setTimeout(resolve, 3000)),
      ]);
      if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    }
    await fs.rm(temporaryDirectory, { recursive: true, force: true });
  });

  const deadline = Date.now() + 10000;
  let ready = false;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Auth API exited early.\n${output}`);
    try {
      if ((await fetch(`${baseUrl}/api/health`)).ok) {
        ready = true;
        break;
      }
    } catch {
      // The process may still be binding its disposable test port.
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.equal(ready, true, `Auth API did not start.\n${output}`);

  const tokens = {};
  for (const [id, role] of [[41, 'Buyer'], [42, 'Seller'], [43, 'Admin'], [44, 'Agent'], [45, 'Developer']]) {
    const email = `${role.toLowerCase()}-${id}@example.test`;
    const login = await jsonRequest(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: { identifier: email, password },
    });
    assert.equal(login.response.status, 200, `login failed for ${role}: ${JSON.stringify(login.body)}`);
    tokens[role] = login.body.token;
    assert.equal(login.body.user.accountType, 'User');
    assert.equal('password' in login.body.user, false);

    const currentUser = await jsonRequest(baseUrl, '/api/auth/me', { token: tokens[role] });
    assert.equal(currentUser.response.status, 200);
    assert.equal(currentUser.body.accountType, 'User');
    assert.equal('password' in currentUser.body, false);
  }
  const permissionAdminLogin = await jsonRequest(baseUrl, '/api/auth/login', {
    method: 'POST',
    body: { identifier: 'user-46@example.test', password },
  });
  assert.equal(permissionAdminLogin.response.status, 200);
  tokens.PermissionAdmin = permissionAdminLogin.body.token;
  assert.equal(permissionAdminLogin.body.user.role, 'User');
  assert.deepEqual(permissionAdminLogin.body.user.permissions, ['admin']);

  const pendingPermissionAgent = await jsonRequest(baseUrl, '/api/auth/login', {
    method: 'POST',
    body: { identifier: 'user-47@example.test', password },
  });
  assert.equal(pendingPermissionAgent.response.status, 403);
  assert.equal(pendingPermissionAgent.body.code, 'AGENT_PENDING');

  for (const role of ['Buyer', 'Seller']) {
    const email = `${role.toLowerCase()}-${role === 'Buyer' ? 41 : 42}@example.test`;
    const login = await jsonRequest(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    assert.equal(login.body.user.role, 'User');
    assert.deepEqual(login.body.user.permissions, []);
    const currentUser = await jsonRequest(baseUrl, '/api/auth/me', { token: tokens[role] });
    assert.equal(currentUser.body.role, 'User');
    assert.deepEqual(currentUser.body.permissions, []);
  }

  const buyerAppointments = await jsonRequest(baseUrl, '/api/appointments', { token: tokens.Buyer });
  assert.deepEqual(buyerAppointments.body.map(item => item.id), [701]);
  const propertyDetail = await jsonRequest(baseUrl, '/api/properties/1005');
  assert.equal(propertyDetail.response.status, 200);
  assert.equal(propertyDetail.body.title, 'Visible Fixture Listing');
  const propertyPage = await fetch(`${baseUrl}/properties/1005`);
  assert.equal(propertyPage.status, 200);
  assert.match(await propertyPage.text(), /Visible Fixture Listing/);
  const saved = await jsonRequest(baseUrl, '/api/saved/41/1005', { token: tokens.Buyer, method: 'POST' });
  assert.equal(saved.response.status, 200, JSON.stringify(saved.body));
  assert.equal(saved.body?.saved, true, JSON.stringify(saved.body));
  const savedIds = await jsonRequest(baseUrl, '/api/saved/41', { token: tokens.Buyer });
  assert.deepEqual(savedIds.body, [1005]);
  const comparison = await jsonRequest(baseUrl, '/api/comparison', { token: tokens.Buyer, method: 'PUT', body: { propertyIds: [1005] } });
  assert.deepEqual(comparison.body, [1005]);
  const comparisonRead = await jsonRequest(baseUrl, '/api/comparison', { token: tokens.Buyer });
  assert.deepEqual(comparisonRead.body, [1005]);
  const otherComparison = await jsonRequest(baseUrl, '/api/comparison', { token: tokens.Seller });
  assert.deepEqual(otherComparison.body, []);
  const invalidComparison = await jsonRequest(baseUrl, '/api/comparison', { token: tokens.Buyer, method: 'PUT', body: { propertyIds: [1, 2, 3, 4] } });
  assert.equal(invalidComparison.response.status, 400);
  const clearComparison = await jsonRequest(baseUrl, '/api/comparison', { token: tokens.Buyer, method: 'DELETE' });
  assert.equal(clearComparison.response.status, 204);
  const cancelledAppointment = await jsonRequest(baseUrl, '/api/appointments/701', {
    token: tokens.Buyer,
    method: 'PATCH',
    body: { status: 'Cancelled' },
  });
  assert.equal(cancelledAppointment.response.status, 200);
  assert.equal(cancelledAppointment.body.status, 'Cancelled');
  const otherAppointment = await jsonRequest(baseUrl, '/api/appointments/702', {
    token: tokens.Buyer,
    method: 'PATCH',
    body: { status: 'Cancelled' },
  });
  assert.equal(otherAppointment.response.status, 403);

  for (const [role, permission] of [['Admin', 'admin'], ['Agent', 'agent'], ['Developer', 'developer']]) {
    const currentUser = await jsonRequest(baseUrl, '/api/auth/me', { token: tokens[role] });
    assert.equal(currentUser.body.role, role);
    assert.deepEqual(currentUser.body.permissions, [permission]);
  }

  assert.equal((await jsonRequest(baseUrl, '/api/admin/users', { token: tokens.Admin })).response.status, 200);
  assert.equal((await jsonRequest(baseUrl, '/api/admin/users', { token: tokens.PermissionAdmin })).response.status, 200);
  for (const role of ['Buyer', 'Seller', 'Agent', 'Developer']) {
    assert.equal((await jsonRequest(baseUrl, '/api/admin/users', { token: tokens[role] })).response.status, 403);
  }
  assert.equal((await jsonRequest(baseUrl, '/api/developer/projects', { token: tokens.Developer })).response.status, 200);
  for (const role of ['Buyer', 'Seller', 'Agent']) {
    assert.equal((await jsonRequest(baseUrl, '/api/developer/projects', { token: tokens[role] })).response.status, 403);
  }

  const nonAdminRecovery = await jsonRequest(baseUrl, '/api/auth/admin-forgot-password', {
    method: 'POST',
    body: { email: 'buyer-41@example.test' },
  });
  assert.equal(nonAdminRecovery.response.status, 200);
  assert.equal(nonAdminRecovery.body.success, true);
  assert.doesNotMatch(JSON.stringify(nonAdminRecovery.body), /buyer-41@example\.test/i);

  const adminRecovery = await jsonRequest(baseUrl, '/api/auth/admin-forgot-password', {
    method: 'POST',
    body: { email: 'admin-43@example.test' },
  });
  assert.equal(adminRecovery.response.status, 503);
  assert.match(adminRecovery.body.error, /SMTP mailbox settings/i);
  const invalidAdminReset = await jsonRequest(baseUrl, '/api/auth/admin-reset-password', {
    method: 'POST',
    body: {
      email: 'admin-43@example.test',
      code: '123456',
      newPassword: 'NewAdminPassword123',
    },
  });
  assert.equal(invalidAdminReset.response.status, 400);

  const registration = await jsonRequest(baseUrl, '/api/auth/register', {
    method: 'POST',
    body: {
      firstName: 'Public',
      lastName: 'User',
      email: 'new-user@example.test',
      phone: '03005550123',
      password: 'RegisteredUser123',
      confirmPassword: 'RegisteredUser123',
      role: 'Admin',
      accountType: 'Developer',
      permissions: ['admin', 'developer'],
    },
  });
  assert.equal(registration.response.status, 201, JSON.stringify(registration.body));
  assert.equal(registration.body.user.role, 'User');
  assert.equal(registration.body.user.accountType, 'User');
  assert.deepEqual(registration.body.user.permissions, []);
  const registeredCurrentUser = await jsonRequest(baseUrl, '/api/auth/me', { token: registration.body.token });
  assert.equal(registeredCurrentUser.body.role, 'User');
  assert.equal(registeredCurrentUser.body.name, 'Public User');
  assert.deepEqual(registeredCurrentUser.body.permissions, []);
  const registeredAccount = await jsonRequest(baseUrl, '/api/account', { token: registration.body.token });
  assert.equal(registeredAccount.response.status, 200);
  assert.equal(registeredAccount.body.accountType, 'User');
  assert.equal(registeredAccount.body.name, 'Public User');
  assert.deepEqual(registeredAccount.body.permissions, []);
  assert.equal((await jsonRequest(baseUrl, '/api/admin/users', { token: registration.body.token })).response.status, 403);
  const logout = await jsonRequest(baseUrl, '/api/auth/logout', {
    token: registration.body.token,
    method: 'POST',
  });
  assert.equal(logout.response.status, 200);
  assert.equal(logout.body.success, true);
  const afterLogout = await jsonRequest(baseUrl, '/api/auth/me', { token: registration.body.token });
  assert.equal(afterLogout.response.status, 401);
});
