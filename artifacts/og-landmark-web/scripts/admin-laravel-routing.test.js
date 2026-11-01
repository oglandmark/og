const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');

const source = fs.readFileSync(path.join(__dirname, '../public/og-api-base.js'), 'utf8');

function createBrowser(hostname, options = {}) {
  const calls = [];
  const origin = `https://${hostname}`;
  let storedApiBase = options.apiBase || null;
  function XMLHttpRequest() {}
  XMLHttpRequest.prototype.open = function (method, url) {
    calls.push({ type: 'xhr', method, url });
  };

  const window = {
    location: { hostname, origin, search: options.search || '' },
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
      getItem: key => key === 'og_api_base' ? storedApiBase : null,
      removeItem: key => { if (key === 'og_api_base') storedApiBase = null; },
      setItem: (key, value) => { if (key === 'og_api_base') storedApiBase = value; },
    },
  };
  vm.runInNewContext(source, context);
  return { window, calls };
}

test('local Replit admin property queues and review actions use Laravel routes', async () => {
  const { window, calls } = createBrowser('og-landmark.replit.dev');

  await window.fetch('/api/admin/properties?approvalStatus=Pending');
  await window.fetch('/api/admin/properties/42', { method: 'PATCH', body: JSON.stringify({ title: 'Updated house' }) });
  await window.fetch('/api/admin/properties/42/visibility', { method: 'PATCH', body: JSON.stringify({ hidden: true }) });
  await window.fetch('/api/admin/properties/42/feature', { method: 'PATCH', body: JSON.stringify({ featured: true }) });
  await window.fetch('/api/admin/properties/42/recommend', { method: 'PATCH', body: JSON.stringify({ recommended: true }) });
  await window.fetch('/api/admin/properties/42', { method: 'DELETE' });
  await window.fetch('/api/admin/properties/42/review');
  await window.fetch('/api/admin/properties/42/media', { method: 'PATCH' });
  const mediaForm = new FormData();
  mediaForm.append('_method', 'PATCH');
  await window.fetch('/api/admin/properties/42/media', { method: 'POST', body: mediaForm });
  await window.fetch('/api/admin/properties/42/approve', { method: 'PATCH' });
  await window.fetch('/api/admin/properties/42/reject', { method: 'PATCH' });
  await window.fetch('/api/admin/properties/42/request-changes', { method: 'PATCH' });

  assert.equal(window.__OG_ADMIN_LARAVEL_LOCAL__, true);
  assert.deepEqual(calls.map(({ url, method }) => [url, method]), [
    ['/api-legacy/api/admin/properties?approvalStatus=Pending', 'GET'],
    ['/api-legacy/api/admin/properties/42', 'PATCH'],
    ['/api-legacy/api/admin/properties/42/visibility', 'PATCH'],
    ['/api-legacy/api/admin/properties/42/feature', 'PATCH'],
    ['/api-legacy/api/admin/properties/42/recommend', 'PATCH'],
    ['/api-legacy/api/admin/properties/42', 'DELETE'],
    ['/api-legacy/api/admin/properties/42/review', 'GET'],
    ['/api-legacy/api/admin/properties/42/media', 'PATCH'],
    ['/api-legacy/api/admin/properties/42/media', 'POST'],
    ['/api-legacy/api/properties/42/approve', 'PATCH'],
    ['/api-legacy/api/properties/42/reject', 'PATCH'],
    ['/api-legacy/api/properties/42/request-changes', 'PATCH'],
  ]);
});

test('explicit local Laravel property promotion routes bypass proxy rewriting', async () => {
  const { window, calls } = createBrowser('og-landmark.replit.dev');

  await window.fetch('/api-legacy/api/admin/properties/42/feature', {
    method: 'PATCH',
    body: JSON.stringify({ featured: true }),
  });
  await window.fetch('/api-legacy/api/admin/properties/42/recommend', {
    method: 'PATCH',
    body: JSON.stringify({ recommended: true }),
  });
  await window.fetch('/api-legacy/api/admin/properties/42/agent', {
    method: 'PATCH',
    body: JSON.stringify({ userId: '88' }),
  });

  assert.deepEqual(calls.map(({ url, method }) => [url, method]), [
    ['/api-legacy/api/admin/properties/42/feature', 'PATCH'],
    ['/api-legacy/api/admin/properties/42/recommend', 'PATCH'],
    ['/api-legacy/api/admin/properties/42/agent', 'PATCH'],
  ]);
});

test('local Replit agent directory edits use Laravel and become PATCH requests', async () => {
  const { window, calls } = createBrowser('og-landmark.replit.dev');

  await window.fetch('/api/admin/mobile-agents');
  await window.fetch('/api/admin/mobile-agents', { method: 'POST', body: JSON.stringify({ name: 'New Agent' }) });
  await window.fetch('/api/admin/mobile-agents/8', {
    method: 'PUT',
    body: JSON.stringify({ status: 'Suspended', approvalStatus: 'Approved', visible: false }),
  });
  await window.fetch('/api/admin/mobile-agents/8', { method: 'DELETE' });
  await window.fetch('/api/admin/mobile-agent-preview-hidden');
  await window.fetch('/api/admin/mobile-agent-preview-hidden', { method: 'POST', body: JSON.stringify({ id: 'live-8' }) });

  assert.deepEqual(calls.map(({ url, method }) => [url, method]), [
    ['/api-legacy/api/admin/mobile-agents', 'GET'],
    ['/api-legacy/api/admin/mobile-agents', 'POST'],
    ['/api-legacy/api/admin/mobile-agents/8', 'PATCH'],
    ['/api-legacy/api/admin/mobile-agents/8', 'DELETE'],
    ['/api-legacy/api/admin/mobile-agent-preview-hidden', 'GET'],
    ['/api-legacy/api/admin/mobile-agent-preview-hidden', 'POST'],
  ]);
});

test('local banner management and media uploads use Laravel without changing production routing', async () => {
  const { window, calls } = createBrowser('og-landmark.replit.dev');
  await window.fetch('/api/admin/mobile/banners');
  await window.fetch('/api/mobile/banners', { method: 'POST', body: '{}' });
  await window.fetch('/api/mobile/banners/703', { method: 'PUT', body: '{}' });
  await window.fetch('/api/mobile/banners/703', { method: 'DELETE' });
  await window.fetch('/api/upload/video', { method: 'POST', body: new FormData() });
  await window.fetch('/api/admin/property-media/banner.mp4');
  await window.fetch('/api/admin/mobile-banner-preview-hidden', { method: 'POST', body: '{}' });

  assert.deepEqual(calls.map(({ url, method }) => [url, method]), [
    ['/api-legacy/api/admin/mobile/banners', 'GET'],
    ['/api-legacy/api/admin/mobile/banners', 'POST'],
    ['/api-legacy/api/admin/mobile/banners/703', 'PUT'],
    ['/api-legacy/api/admin/mobile/banners/703', 'DELETE'],
    ['/api-legacy/api/upload/video', 'POST'],
    ['/api-legacy/api/admin/property-media/banner.mp4', 'GET'],
    ['/api-legacy/api/admin/mobile-banner-preview-hidden', 'POST'],
  ]);
});

test('local Replit user and report moderation use Laravel routes', async () => {
  const { window, calls } = createBrowser('og-landmark.replit.dev');

  await window.fetch('/api/users?role=User');
  await window.fetch('/api/admin/users/42/activity?limit=10');
  await window.fetch('/api/users/42', { method: 'PUT' });
  await window.fetch('/api/users/42', { method: 'DELETE' });
  await window.fetch('/api/admin/users/42/permissions', { method: 'PATCH' });
  await window.fetch('/api/admin/reports?status=Pending');
  await window.fetch('/api/admin/reports/301', { method: 'PATCH' });

  assert.deepEqual(calls.map(({ url, method }) => [url, method]), [
    ['/api-legacy/api/admin/users?role=User', 'GET'],
    ['/api-legacy/api/admin/users/42/activity?limit=10', 'GET'],
    ['/api-legacy/api/admin/users/42', 'PUT'],
    ['/api-legacy/api/admin/users/42', 'DELETE'],
    ['/api-legacy/api/admin/users/42/permissions', 'PATCH'],
    ['/api-legacy/api/admin/reports?status=Pending', 'GET'],
    ['/api-legacy/api/admin/reports/301', 'PATCH'],
  ]);
});

test('localhost admin edits target the local Laravel service', async () => {
  const { window, calls } = createBrowser('localhost');

  await window.fetch('/api/admin/mobile-agents/8', { method: 'PUT' });
  await window.fetch('/api/admin/mobile-agents', { method: 'POST' });
  await window.fetch('/api/admin/mobile-agents/8', { method: 'DELETE' });

  assert.deepEqual(calls.map(({ url, method }) => [url, method]), [
    ['http://127.0.0.1:8000/api/admin/mobile-agents/8', 'PATCH'],
    ['http://127.0.0.1:8000/api/admin/mobile-agents', 'POST'],
    ['http://127.0.0.1:8000/api/admin/mobile-agents/8', 'DELETE'],
  ]);
});

test('production admin API routing uses the root-domain Express API', async () => {
  const { window, calls } = createBrowser('www.oglandmark.com');

  await window.fetch('/api/admin/properties');
  await window.fetch('/api/admin/properties/42', { method: 'PATCH', body: JSON.stringify({ title: 'Updated house' }) });
  await window.fetch('/api/admin/properties/42/visibility', { method: 'PATCH', body: JSON.stringify({ hidden: true }) });
  await window.fetch('/api/admin/properties/42/feature', { method: 'PATCH', body: JSON.stringify({ featured: true }) });
  await window.fetch('/api/admin/properties/42/recommend', { method: 'PATCH', body: JSON.stringify({ recommended: true }) });
  await window.fetch('/api/admin/properties/42/approve', { method: 'PATCH' });
  await window.fetch('/api/properties/42/approve', { method: 'PATCH' });
  await window.fetch('/api/admin/properties/42/media', { method: 'POST' });
  await window.fetch('/api/admin/mobile-agents/8', { method: 'PUT' });
  await window.fetch('/api/admin/mobile-agents', { method: 'POST' });
  await window.fetch('/api/admin/mobile-agents/8', { method: 'DELETE' });

  assert.equal(window.__OG_ADMIN_LARAVEL_LOCAL__, false);
  assert.deepEqual(calls.map(({ url, method }) => [url, method]), [
    ['https://oglandmark.com/api/admin/properties', 'GET'],
    ['https://oglandmark.com/api/admin/properties/42', 'PATCH'],
    ['https://oglandmark.com/api/admin/properties/42/visibility', 'PATCH'],
    ['https://oglandmark.com/api/admin/properties/42/feature', 'PATCH'],
    ['https://oglandmark.com/api/admin/properties/42/recommend', 'PATCH'],
    ['https://oglandmark.com/api/admin/properties/42/approve', 'PATCH'],
    ['https://oglandmark.com/api/properties/42/approve', 'PATCH'],
    ['https://oglandmark.com/api/admin/properties/42/media', 'POST'],
    ['https://oglandmark.com/api/admin/mobile-agents/8', 'PUT'],
    ['https://oglandmark.com/api/admin/mobile-agents', 'POST'],
    ['https://oglandmark.com/api/admin/mobile-agents/8', 'DELETE'],
  ]);
});

test('production clears the stale API-subdomain override and uses root-domain API', async () => {
  const { window, calls } = createBrowser('oglandmark.com', {
    apiBase: 'https://api.oglandmark.com/api',
  });

  await window.fetch('/api/auth/login', { method: 'POST' });

  assert.equal(window.__OG_API_BASE__, 'https://oglandmark.com/api');
  assert.deepEqual(calls.map(({ url, method }) => [url, method]), [
    ['https://oglandmark.com/api/auth/login', 'POST'],
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

