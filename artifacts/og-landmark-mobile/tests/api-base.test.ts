import assert from 'node:assert/strict';
import test from 'node:test';
import {
  LIVE_API_BASE,
  getPreviewLiveProxyPath,
  resolveApiBase,
  shouldFallbackUnauthenticatedReadToLive,
} from '../lib/apiBase';

test('Replit previews use the local Laravel API route', () => {
  assert.equal(resolveApiBase('preview.replit.dev'), 'https://preview.replit.dev/api-legacy');
  assert.equal(resolveApiBase('preview.expo.pike.replit.dev'), 'https://preview.expo.pike.replit.dev/api-legacy');
  assert.equal(resolveApiBase('https://preview.replit.dev/mobile/'), 'https://preview.replit.dev/api-legacy');
});

test('production and untrusted domains use the public API', () => {
  assert.equal(resolveApiBase(''), 'https://www.oglandmark.com');
  assert.equal(resolveApiBase('www.oglandmark.com'), 'https://www.oglandmark.com');
  assert.equal(resolveApiBase('malicious.example'), 'https://www.oglandmark.com');
});

test('only unauthenticated GET requests may fall back after a local 404', () => {
  const preview = resolveApiBase('preview.expo.pike.replit.dev');
  assert.equal(shouldFallbackUnauthenticatedReadToLive(preview, 'GET', false, 404), true);
  assert.equal(shouldFallbackUnauthenticatedReadToLive(preview, 'POST', false, 404), false);
  assert.equal(shouldFallbackUnauthenticatedReadToLive(preview, 'GET', true, 404), false);
  assert.equal(shouldFallbackUnauthenticatedReadToLive(preview, 'GET', false, 500), false);
  assert.equal(shouldFallbackUnauthenticatedReadToLive(LIVE_API_BASE, 'GET', false, 404), false);
});

test('preview-only fallback routes stay on the same-origin Laravel service', () => {
  assert.equal(getPreviewLiveProxyPath('/api/mobile/settings'), '/api/preview/live/mobile/settings');
  assert.equal(getPreviewLiveProxyPath('/api/mobile/banners'), '/api/preview/live/mobile/banners');
  assert.equal(getPreviewLiveProxyPath('/api/auth/admin-verify'), undefined);
});