import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveApiBase } from '../lib/apiBase';

test('all mobile builds use the requested live website backend directly', () => {
  assert.equal(resolveApiBase(), 'https://www.oglandmark.com');
});