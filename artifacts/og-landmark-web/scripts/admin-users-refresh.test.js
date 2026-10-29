const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const source = fs.readFileSync(
  path.join(__dirname, '../public/admin/admin-users-refresh.js'),
  'utf8',
);

test('Admin Users reloads when a newly registered account appears', async () => {
  let users = [{ id: 1001, role: 'User' }];
  let reloads = 0;
  let intervalCallback;
  const windowListeners = {};
  const documentListeners = {};
  const windowRef = {
    location: {
      pathname: '/admin/users',
      origin: 'https://og-landmark.replit.dev',
      reload: () => { reloads += 1; },
    },
    localStorage: { getItem: (key) => key === 'og_token' ? 'admin-token' : null },
    addEventListener: (name, callback) => { windowListeners[name] = callback; },
    setInterval: (callback) => { intervalCallback = callback; },
    fetch: async () => ({
      ok: true,
      clone: () => ({ json: async () => users }),
      json: async () => users,
    }),
  };
  const documentRef = {
    visibilityState: 'visible',
    addEventListener: (name, callback) => { documentListeners[name] = callback; },
  };

  vm.runInNewContext(source, {
    window: windowRef,
    document: documentRef,
    URL,
  });

  await windowRef.fetch('/api/users');
  await Promise.resolve();
  users = [{ id: 1001, role: 'User' }, { id: 1002, role: 'User' }];
  await intervalCallback();

  assert.equal(reloads, 1);
  assert.equal(typeof windowListeners.focus, 'function');
  assert.equal(typeof documentListeners.visibilitychange, 'function');
});
