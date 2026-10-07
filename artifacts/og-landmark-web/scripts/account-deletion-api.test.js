'use strict';

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const webDirectory = path.resolve(__dirname, '..');
const deletedEmail = 'deletion-target@example.test';
const retainedEmail = 'unrelated-user@example.test';
const password = 'DisposablePass123';

function fixtureUser(id, email, name) {
  const salt = `account-deletion-${id}`;
  const hash = require('node:crypto')
    .pbkdf2Sync(password, salt, 100000, 64, 'sha512')
    .toString('hex');
  return {
    id,
    email,
    name,
    phone: `+1 555 010${String(id).padStart(2, '0')}`,
    role: id === 41 ? 'Seller' : 'Buyer',
    status: 'Active',
    password: `pbkdf2:${salt}:${hash}`,
    ...(id === 41 ? { profilePhoto: '/images/uploads/orphan.jpg' } : {}),
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
  return {
    response,
    body: text ? JSON.parse(text) : null,
  };
}

async function waitForServer(child, baseUrl, getOutput) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Test API server exited early.\n${getOutput()}`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {
      // The child may still be binding its disposable test port.
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Test API server did not become ready.\n${getOutput()}`);
}

test('DELETE /api/account removes only the authenticated account and its linked data', {
  timeout: 30000,
}, async t => {
  const temporaryDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'og-account-api-e2e-'));
  const mediaDirectory = path.join(temporaryDirectory, 'uploads');
  const dataFile = path.join(temporaryDirectory, 'runtime-data.json');
  await fs.mkdir(mediaDirectory, { recursive: true });
  await fs.writeFile(path.join(mediaDirectory, 'orphan.jpg'), 'account-owned fixture upload');
  await fs.writeFile(path.join(mediaDirectory, 'shared.jpg'), 'shared listing fixture upload');

  const fixture = {
    users: [
      fixtureUser(41, deletedEmail, 'Disposable Seller'),
      fixtureUser(99, retainedEmail, 'Retained Buyer'),
    ],
    properties: [
      { id: 1, sellerId: 41, title: 'Owned listing', images: ['/images/uploads/orphan.jpg'] },
      {
        id: 2,
        sellerId: 99,
        agentId: 41,
        agentName: 'Disposable Seller',
        agentPhone: '+1 555 01041',
        images: ['/images/uploads/shared.jpg'],
      },
      { id: 3, sellerId: 99, agentId: 99, images: ['/images/uploads/shared.jpg'] },
    ],
    mobileAgents: [
      { id: 'agent-41', authUserId: 41, displayName: 'Disposable Seller' },
      { id: 'agent-99', authUserId: 99, displayName: 'Retained Buyer' },
    ],
    savedProperties: { 41: [1], 99: [3] },
    savedSearches: [
      { id: 'search-41', userId: 41 },
      { id: 'search-99', userId: 99 },
    ],
    conversations: [
      {
        id: 'one-to-one',
        participantIds: [41, 99],
        participantNames: ['Disposable Seller', 'Retained Buyer'],
        messages: [
          { id: 'own-conversation-message', senderId: 41, text: 'Remove this message' },
          { id: 'other-conversation-message', senderId: 99, text: 'Keep this message' },
        ],
      },
      {
        id: 'group',
        participantIds: [41, 99, 100],
        participantNames: ['Disposable Seller', 'Retained Buyer', 'Third User'],
        messages: [
          { id: 'group-own-message', senderId: 41, text: 'Remove this message' },
          { id: 'group-other-message', senderId: 99, text: 'Keep this message' },
          { id: 'group-third-message', senderId: 100, text: 'Keep this message too' },
        ],
      },
    ],
    messages: [
      { id: 'own-message', senderId: 41, text: 'Remove this message' },
      { id: 'other-message', senderId: 99, text: 'Keep this message' },
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
      REPLIT_ENVIRONMENT: 'account-deletion-e2e',
      REPLIT_DEV_DOMAIN: '',
      PORT: String(port),
      DATABASE_URL: '',
      OG_LANDMARK_RUNTIME_DATA: dataFile,
      MEDIA_STORAGE_DIR: mediaDirectory,
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
  const collectOutput = stream => stream.on('data', chunk => {
    output = `${output}${chunk.toString()}`.slice(-8000);
  });
  collectOutput(child.stdout);
  collectOutput(child.stderr);

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

  await waitForServer(child, baseUrl, () => output);

  const firstLogin = await jsonRequest(baseUrl, '/api/auth/login', {
    method: 'POST',
    body: { email: deletedEmail, password },
  });
  assert.equal(firstLogin.response.status, 200);
  const firstToken = firstLogin.body.token;
  assert.ok(firstToken);

  const secondLogin = await jsonRequest(baseUrl, '/api/auth/login', {
    method: 'POST',
    body: { email: deletedEmail, password },
  });
  assert.equal(secondLogin.response.status, 200);
  const secondToken = secondLogin.body.token;
  assert.ok(secondToken);

  const retainedLogin = await jsonRequest(baseUrl, '/api/auth/login', {
    method: 'POST',
    body: { email: retainedEmail, password },
  });
  assert.equal(retainedLogin.response.status, 200);
  const retainedToken = retainedLogin.body.token;

  const challengeRequest = await jsonRequest(baseUrl, '/api/auth/request-reset', {
    method: 'POST',
    body: { email: deletedEmail },
  });
  assert.equal(challengeRequest.response.status, 200);
  assert.equal(challengeRequest.body.smtpOff, true, 'test reset email delivery stays disabled');

  const retainedChallengeRequest = await jsonRequest(baseUrl, '/api/auth/request-reset', {
    method: 'POST',
    body: { email: retainedEmail },
  });
  assert.equal(retainedChallengeRequest.response.status, 200);

  const deletion = await jsonRequest(baseUrl, '/api/account', {
    method: 'DELETE',
    token: firstToken,
  });
  assert.equal(deletion.response.status, 204);
  assert.equal(deletion.body, null);

  for (const token of [firstToken, secondToken]) {
    const sessionCheck = await jsonRequest(baseUrl, '/api/account', { token });
    assert.equal(sessionCheck.response.status, 401, 'all sessions for the deleted account are invalidated');
  }
  const retainedSession = await jsonRequest(baseUrl, '/api/account', { token: retainedToken });
  assert.equal(retainedSession.response.status, 200, 'unrelated users keep their sessions');

  const deletedChallengeCheck = await jsonRequest(baseUrl, '/api/auth/confirm-reset', {
    method: 'POST',
    body: { email: deletedEmail, otp: '000000', newPassword: 'UpdatedPass123' },
  });
  assert.equal(deletedChallengeCheck.response.status, 401);
  assert.match(deletedChallengeCheck.body.error, /Code expired/i);

  const retainedChallengeCheck = await jsonRequest(baseUrl, '/api/auth/confirm-reset', {
    method: 'POST',
    body: { email: retainedEmail, otp: '000000', newPassword: 'UpdatedPass123' },
  });
  assert.equal(retainedChallengeCheck.response.status, 401);
  assert.match(retainedChallengeCheck.body.error, /Incorrect code/i);

  const stored = JSON.parse(await fs.readFile(dataFile, 'utf8'));
  assert.deepEqual(stored.users.map(user => user.id), [99]);
  assert.deepEqual(stored.properties.map(property => property.id), [2, 3]);
  assert.equal(stored.properties[0].agentId, undefined);
  assert.equal(stored.properties[0].agentName, undefined);
  assert.equal(stored.properties[0].agentPhone, undefined);
  assert.deepEqual(stored.mobileAgents.map(agent => agent.id), ['agent-99']);
  assert.equal(stored.savedProperties[41], undefined);
  assert.deepEqual(stored.savedProperties[99], [3]);
  assert.deepEqual(stored.savedSearches.map(search => search.id), ['search-99']);
  assert.deepEqual(stored.messages.map(message => message.id), ['other-message']);
  assert.deepEqual(stored.conversations.map(conversation => conversation.id), ['group']);
  assert.deepEqual(
    stored.conversations[0].messages.map(message => message.id),
    ['group-other-message', 'group-third-message'],
  );
  assert.equal(JSON.stringify(stored).includes(deletedEmail), false);
  assert.equal(JSON.stringify(stored).includes('Disposable Seller'), false);

  await assert.rejects(fs.access(path.join(mediaDirectory, 'orphan.jpg')));
  await fs.access(path.join(mediaDirectory, 'shared.jpg'));
});
