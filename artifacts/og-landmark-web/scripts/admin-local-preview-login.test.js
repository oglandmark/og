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

async function startSmtpCapture() {
  const messages = [];
  const server = require('node:net').createServer(socket => {
    socket.setEncoding('utf8');
    socket.write('220 preview.test ESMTP\r\n');
    let buffer = '';
    let message = '';
    let inData = false;
    let authStage = 0;

    socket.on('data', chunk => {
      buffer += chunk;
      while (buffer.includes('\n')) {
        const newline = buffer.indexOf('\n');
        const line = buffer.slice(0, newline).replace(/\r$/, '');
        buffer = buffer.slice(newline + 1);

        if (inData) {
          if (line === '.') {
            inData = false;
            messages.push(message);
            message = '';
            socket.write('250 2.0.0 queued\r\n');
          } else {
            message += `${line.replace(/^\.\./, '.')}\n`;
          }
          continue;
        }

        const command = line.toUpperCase();
        if (command.startsWith('EHLO') || command.startsWith('HELO')) {
          socket.write('250-preview.test\r\n250-AUTH PLAIN LOGIN\r\n250 SIZE 10000000\r\n');
        } else if (command.startsWith('AUTH PLAIN')) {
          socket.write('235 2.7.0 authenticated\r\n');
        } else if (command === 'AUTH LOGIN') {
          authStage = 1;
          socket.write('334 VXNlcm5hbWU6\r\n');
        } else if (authStage === 1) {
          authStage = 2;
          socket.write('334 UGFzc3dvcmQ6\r\n');
        } else if (authStage === 2) {
          authStage = 0;
          socket.write('235 2.7.0 authenticated\r\n');
        } else if (command.startsWith('MAIL FROM:') || command.startsWith('RCPT TO:')) {
          socket.write('250 2.1.0 accepted\r\n');
        } else if (command === 'DATA') {
          inData = true;
          socket.write('354 end with dot\r\n');
        } else if (command === 'NOOP' || command === 'RSET') {
          socket.write('250 2.0.0 ok\r\n');
        } else if (command === 'QUIT') {
          socket.write('221 2.0.0 bye\r\n');
          socket.end();
        } else {
          socket.write('250 2.0.0 ok\r\n');
        }
      }
    });
  });

  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return {
    server,
    port: server.address().port,
    messages,
    close: () => new Promise(resolve => server.close(() => resolve())),
  };
}

async function postJson(baseUrl, route, body) {
  const response = await fetch(`${baseUrl}${route}`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { response, payload: await response.json() };
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
      role: 'User',
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
    assert.equal(payload.user?.role, 'User');
    assert.deepEqual(payload.user?.permissions, ['admin']);
    assert.equal(typeof payload.token, 'string');
    const currentUserResponse = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${payload.token}` },
    });
    const currentUser = await currentUserResponse.json();
    assert.equal(currentUserResponse.status, 200);
    assert.equal(currentUser.role, 'User');
    assert.deepEqual(currentUser.permissions, ['admin']);
    const adminPropertiesResponse = await fetch(`${baseUrl}/api/admin/properties`, {
      headers: { Authorization: `Bearer ${payload.token}` },
    });
    assert.equal(adminPropertiesResponse.status, 200);
  } finally {
    await stopProcess(child);
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test('preview Admin reset sends an OTP, persists the new password, and rejects the wrong email', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'og-admin-reset-'));
  const dataPath = path.join(directory, 'runtime-data.json');
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const previewPassword = 'PreviewOnlyFixture123!';
  const newPassword = 'ResetPreviewPassword123!';
  const email = 'preview-admin@example.test';
  const smtp = await startSmtpCapture();
  fs.writeFileSync(dataPath, JSON.stringify({
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
  }), { mode: 0o600 });

  const child = spawn(process.execPath, [path.join(webRoot, 'server.js')], {
    cwd: webRoot,
    stdio: 'ignore',
    env: isolatedEnvironment({
      NODE_ENV: 'development',
      APP_ENV: '',
      PORT: String(port),
      REPLIT_DEV_DOMAIN: 'og-admin-preview-reset.replit.dev',
      REPLIT_ENVIRONMENT: 'development',
      LOCAL_PREVIEW_ADMIN_PASSWORD: previewPassword,
      LOCAL_PREVIEW_ADMIN_EMAIL: '',
      OG_LANDMARK_RUNTIME_DATA: dataPath,
      DATABASE_URL: '',
      NEON_DATABASE_URL: '',
      SMTP_HOST: '127.0.0.1',
      SMTP_PORT: String(smtp.port),
      SMTP_SECURE: 'false',
      SMTP_USER: 'preview-test',
      SMTP_PASS: 'preview-test',
    }),
  });

  try {
    await waitForHealth(child, `${baseUrl}/api/health`);

    const unknownEmail = await postJson(baseUrl, '/api/auth/admin-forgot-password', {
      email: 'wrong-admin@example.test',
    });
    assert.equal(unknownEmail.response.status, 404);
    assert.match(unknownEmail.payload.error, /matches this email/i);

    const requestCode = await postJson(baseUrl, '/api/auth/admin-forgot-password', { email });
    assert.equal(requestCode.response.status, 200, requestCode.payload.error || 'Reset email should be accepted.');
    assert.equal(requestCode.payload.success, true);
    assert.equal(smtp.messages.length, 1, 'SMTP should receive one Admin reset email.');
    const code = smtp.messages[0].match(/>(\d{6})</)?.[1];
    assert.ok(code, 'The captured reset email should contain a six-digit code.');

    const reset = await postJson(baseUrl, '/api/auth/admin-reset-password', {
      email,
      code,
      newPassword,
    });
    assert.equal(reset.response.status, 200, reset.payload.error || 'The reset code should update the password.');

    const resetLogin = await postJson(baseUrl, '/api/auth/admin-verify', { email, password: newPassword });
    assert.equal(resetLogin.response.status, 200, resetLogin.payload.error || 'The reset password should remain active.');
    assert.equal(typeof resetLogin.payload.token, 'string');

    const oldLogin = await postJson(baseUrl, '/api/auth/admin-verify', { email, password: previewPassword });
    assert.equal(oldLogin.response.status, 401);
  } finally {
    await stopProcess(child);
    await smtp.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
