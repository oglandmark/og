const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../public/og-api-base.js'), 'utf8');

function createBrowser(hostname) {
  const calls = [];
  const origin = `https://${hostname}`;
  function XMLHttpRequest() {}
  XMLHttpRequest.prototype.open = function (method, url) {
    calls.push({ type: 'xhr', method, url });
  };

  const window = {
    location: { hostname, origin, search: '' },
    fetch: async (input, init = {}) => {
      calls.push({
        type: 'fetch',
        url: typeof input === 'string' ? input : input.url,
        method: init.method || input?.method || 'GET',
      });
      return { ok: true };
    },
  };
  const context = {
    window,
    XMLHttpRequest,
    URL,
    URLSearchParams,
    Request,
    localStorage: {
      getItem: () => null,
      removeItem: () => {},
      setItem: () => {},
    },
  };
  vm.runInNewContext(source, context);
  return { window, calls };
}

test('local Replit admin property queues and review actions use Laravel routes', async () => {
  const { window, calls } = createBrowser('og-landmark.replit.dev');

  await window.fetch('/api/admin/properties?approvalStatus=Pending');
  await window.fetch('/api/admin/properties/42/review');
  await window.fetch('/api/admin/properties/42/approve', { method: 'PATCH' });
  await window.fetch('/api/admin/properties/42/reject', { method: 'PATCH' });
  await window.fetch('/api/admin/properties/42/request-changes', { method: 'PATCH' });

  assert.equal(window.__OG_ADMIN_LARAVEL_LOCAL__, true);
  assert.deepEqual(calls.map(({ url, method }) => [url, method]), [
    ['/api-legacy/api/admin/properties?approvalStatus=Pending', 'GET'],
    ['/api-legacy/api/admin/properties/42/review', 'GET'],
    ['/api-legacy/api/properties/42/approve', 'PATCH'],
    ['/api-legacy/api/properties/42/reject', 'PATCH'],
    ['/api-legacy/api/properties/42/request-changes', 'PATCH'],
  ]);
});

test('local Replit agent directory edits use Laravel and become PATCH requests', async () => {
  const { window, calls } = createBrowser('og-landmark.replit.dev');

  await window.fetch('/api/admin/mobile-agents');
  await window.fetch('/api/admin/mobile-agents/8', {
    method: 'PUT',
    body: JSON.stringify({ status: 'Suspended', approvalStatus: 'Approved', visible: false }),
  });

  assert.deepEqual(calls.map(({ url, method }) => [url, method]), [
    ['/api-legacy/api/admin/mobile-agents', 'GET'],
    ['/api-legacy/api/admin/mobile-agents/8', 'PATCH'],
  ]);
});

test('localhost admin edits target the local Laravel service', async () => {
  const { window, calls } = createBrowser('localhost');

  await window.fetch('/api/admin/mobile-agents/8', { method: 'PUT' });

  assert.deepEqual(calls.map(({ url, method }) => [url, method]), [
    ['http://127.0.0.1:8000/api/admin/mobile-agents/8', 'PATCH'],
  ]);
});

test('production admin API routing remains on the existing production API', async () => {
  const { window, calls } = createBrowser('www.oglandmark.com');

  await window.fetch('/api/admin/properties');
  await window.fetch('/api/admin/properties/42/approve', { method: 'PATCH' });
  await window.fetch('/api/admin/mobile-agents/8', { method: 'PUT' });

  assert.equal(window.__OG_ADMIN_LARAVEL_LOCAL__, false);
  assert.deepEqual(calls.map(({ url, method }) => [url, method]), [
    ['https://api.oglandmark.com/api/admin/properties', 'GET'],
    ['https://api.oglandmark.com/api/admin/properties/42/approve', 'PATCH'],
    ['https://api.oglandmark.com/api/admin/mobile-agents/8', 'PUT'],
  ]);
});

test('published Replit domains do not opt into local Laravel routing', async () => {
  const { window, calls } = createBrowser('og-landmark.replit.app');

  await window.fetch('/api/admin/properties');

  assert.equal(window.__OG_ADMIN_LARAVEL_LOCAL__, false);
  assert.deepEqual(calls.map(({ url, method }) => [url, method]), [
    ['/api/admin/properties', 'GET'],
  ]);
});

