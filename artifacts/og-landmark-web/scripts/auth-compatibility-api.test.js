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
    properties: [],
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
  assert.deepEqual(registeredCurrentUser.body.permissions, []);
  const registeredAccount = await jsonRequest(baseUrl, '/api/account', { token: registration.body.token });
  assert.equal(registeredAccount.response.status, 200);
  assert.equal(registeredAccount.body.accountType, 'User');
  assert.deepEqual(registeredAccount.body.permissions, []);
  assert.equal((await jsonRequest(baseUrl, '/api/admin/users', { token: registration.body.token })).response.status, 403);
});
