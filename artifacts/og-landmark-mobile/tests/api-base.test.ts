import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveApiBase } from '../lib/apiBase';

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