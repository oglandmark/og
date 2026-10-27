import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveApiBase } from '../lib/apiBase';

test('mobile requests use the public API even in a Replit preview', () => {
  assert.equal(resolveApiBase('preview.replit.dev'), 'https://www.oglandmark.com');
});

test('a preview URL cannot override the public API base', () => {
  assert.equal(resolveApiBase('https://preview.replit.dev/api/'), 'https://www.oglandmark.com');
});

test('builds without a preview domain use the public API', () => {
  assert.equal(resolveApiBase(''), 'https://www.oglandmark.com');
});