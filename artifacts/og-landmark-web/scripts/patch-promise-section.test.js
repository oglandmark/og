const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const patchPromiseSection = require('./patch-promise-section');

const bundle = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'assets', 'index-CXxrK7KP.js'),
  'utf8',
);

test('the homepage replaces its old trust section with the animated Promise section', () => {
  const patched = patchPromiseSection(bundle);

  assert.equal(patched.includes('children:"Why Choose OG Landmark"'), false);
  assert.ok(patched.includes('The OG Landmark Promise'));
  assert.ok(patched.includes('Verified Developers'));
  assert.ok(patched.includes('href=\\"/properties\\"'));
  assert.ok(patched.includes('i.jsx("section",{className:"py-20 bg-muted"'));
});

test('the Promise section patch fails explicitly if the expected homepage section changes', () => {
  assert.throws(
    () => patchPromiseSection(bundle.replace('Why Choose OG Landmark', 'Homepage trust')),
    /Could not find the single existing Why Choose section/,
  );
});
