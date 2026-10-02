import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveApiBase } from '../lib/apiBase';

test('Replit development builds use the local API proxy on native and web', () => {
  assert.equal(
    resolveApiBase({
      configuredApiUrl: 'https://api.oglandmark.com',
      replitId: 'replit-preview',
      replitDomain: 'preview.example.replit.dev',
      isDevelopment: true,
    }),
    'https://preview.example.replit.dev',
  );
});

test('non-Replit builds preserve the configured API URL', () => {
  assert.equal(
    resolveApiBase({
      configuredApiUrl: 'https://staging.example.com/api/',
      isDevelopment: true,
    }),
    'https://staging.example.com/api',
  );
});

test('production defaults to the canonical API URL', () => {
  assert.equal(resolveApiBase({ isDevelopment: false }), 'https://api.oglandmark.com');
});