const assert = require('node:assert/strict');
const test = require('node:test');
const { stableStringify, sha256Json } = require('./json-parity');

test('canonical JSON ignores object key order but preserves array order', () => {
  assert.equal(stableStringify({ b: 2, a: { y: 1, x: 0 } }), stableStringify({ a: { x: 0, y: 1 }, b: 2 }));
  assert.notEqual(stableStringify([1, 2]), stableStringify([2, 1]));
});

test('canonical JSON digest is stable', () => {
  assert.equal(sha256Json({ b: 2, a: 1 }), sha256Json({ a: 1, b: 2 }));
});