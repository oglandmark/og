import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  LIVE_API_BASE,
  getPreviewLiveProxyPath,
  resolveApiBase,
  shouldFallbackUnauthenticatedReadToLive,
} from '../lib/apiBase';

const apiClient = readFileSync(new URL('../lib/api.ts', import.meta.url), 'utf8');
const mobilePackage = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

test('the preview resolver can address the local Laravel API route', () => {
  assert.equal(resolveApiBase('preview.replit.dev'), 'https://preview.replit.dev/api-legacy');
  assert.equal(resolveApiBase('preview.expo.pike.replit.dev'), 'https://preview.expo.pike.replit.dev/api-legacy');
  assert.equal(resolveApiBase('https://preview.replit.dev/mobile/'), 'https://preview.replit.dev/api-legacy');
});

test('the mobile client keeps account and inventory requests on the live API', () => {
  assert.match(apiClient, /API_BASE\s*=\s*LIVE_API_BASE/);
  assert.doesNotMatch(apiClient, /API_BASE\s*=\s*resolveApiBase/);
});

test('preview-only Admin project reads use a separate local website API base', () => {
  assert.match(apiClient, /EXPO_PUBLIC_LOCAL_WEB_API_BASE/);
  assert.match(apiClient, /getLocalPreviewWebApiData/);
  assert.match(apiClient, /getLocalPreviewProjectSettings/);
  assert.match(mobilePackage.scripts.dev, /EXPO_PUBLIC_LOCAL_WEB_API_BASE/);
  assert.match(mobilePackage.scripts.dev, /REPLIT_DEV_DOMAIN/);
});

test('production and untrusted domains use the public API', () => {
  assert.equal(resolveApiBase(''), 'https://api.oglandmark.com');
  assert.equal(resolveApiBase('https://oglandmark.com'), 'https://api.oglandmark.com');
  assert.equal(resolveApiBase('api.oglandmark.com'), 'https://api.oglandmark.com');
  assert.equal(resolveApiBase('malicious.example'), 'https://api.oglandmark.com');
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
  assert.equal(
    getPreviewLiveProxyPath('/api/properties?limit=6&sort=latest'),
    '/api/preview/live/properties?limit=6&sort=latest',
  );
  assert.equal(getPreviewLiveProxyPath('/api/properties/42'), '/api/preview/live/properties/42');
  assert.equal(
    getPreviewLiveProxyPath('/api/mobile-agents?limit=5&city=Okara'),
    '/api/preview/live/mobile-agents?limit=5&city=Okara',
  );
  assert.equal(getPreviewLiveProxyPath('/api/mobile/settings'), '/api/preview/live/mobile/settings');
  assert.equal(getPreviewLiveProxyPath('/api/mobile/banners'), undefined);
  assert.equal(getPreviewLiveProxyPath('/api/auth/admin-verify'), undefined);
});