'use strict';

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { createServer } = require('node:net');
const { once } = require('node:events');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const webRoot = path.resolve(__dirname, '..');

function fixturePassword(password) {
  const salt = 'preview-login-fixture';
  const hash = crypto.pbkdf2Sync(password, salt, 100_000, 64, 'sha512').toString('hex');
  return `pbkdf2:${salt}:${hash}`;
}

async function freePort() {
  const server = createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  return port;
}

function isolatedEnvironment(overrides) {
  const environment = { ...process.env };
  for (const key of Object.keys(environment)) {
    if (/DATABASE|MYSQL|POSTGRES|NEON|SUPABASE|SECRET|TOKEN|PASSWORD|SMTP|MAIL_(?:USER|PASS)|LARAVEL_.*URL/i.test(key)) {
      delete environment[key];
    }
  }
  return { ...environment, ...overrides };
}

async function waitForHealth(child, url) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Preview server exited (${child.exitCode}).`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('Preview server did not become ready.');
}

async function stopProcess(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([
    once(child, 'exit'),
    new Promise(resolve => setTimeout(resolve, 5_000)),
  ]);
}

test('Replit preview Admin login uses configured password without requiring APP_ENV or OTP', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'og-admin-preview-login-'));
  const dataPath = path.join(directory, 'runtime-data.json');
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const previewPassword = 'PreviewOnlyFixture123!';
  const email = 'preview-admin@example.test';
  const fixture = {
    users: [{
      id: 1,
      name: 'Preview Admin',
      email,
      role: 'Admin',
      status: 'Active',
      permissions: ['admin'],
      password: fixturePassword('OldPassword123!'),
    }],
    properties: [],
    mobileAgents: [],
  };
  fs.writeFileSync(dataPath, JSON.stringify(fixture), { mode: 0o600 });

  const child = spawn(process.execPath, [path.join(webRoot, 'server.js')], {
    cwd: webRoot,
    stdio: 'ignore',
    env: isolatedEnvironment({
      NODE_ENV: 'development',
      APP_ENV: '',
      PORT: String(port),
      REPLIT_DEV_DOMAIN: 'og-admin-preview-login.replit.dev',
      REPLIT_ENVIRONMENT: 'development',
      LOCAL_PREVIEW_ADMIN_PASSWORD: previewPassword,
      LOCAL_PREVIEW_ADMIN_EMAIL: '',
      OG_LANDMARK_RUNTIME_DATA: dataPath,
      DATABASE_URL: '',
      NEON_DATABASE_URL: '',
    }),
  });

  try {
    await waitForHealth(child, `${baseUrl}/api/health`);
    const response = await fetch(`${baseUrl}/api/auth/admin-verify`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: previewPassword }),
    });
    const payload = await response.json();
    assert.equal(response.status, 200, payload.error || 'Admin preview login should succeed.');
    assert.equal(payload.user?.role, 'Admin');
    assert.equal(typeof payload.token, 'string');
  } finally {
    await stopProcess(child);
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
