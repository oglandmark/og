import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveApiBase } from '../lib/apiBase';

test('Replit preview uses the workspace API for mobile requests', () => {
  assert.equal(resolveApiBase('preview.replit.dev'), 'https://preview.replit.dev');
});

test('a preview domain with a scheme and API path is normalized to its origin', () => {
  assert.equal(resolveApiBase('https://preview.replit.dev/api/'), 'https://preview.replit.dev');
});

test('builds without a preview domain retain the configured live backend', () => {
  assert.equal(resolveApiBase(''), 'https://www.oglandmark.com');
});