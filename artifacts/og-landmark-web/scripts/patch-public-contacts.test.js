const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const patchPublicContacts = require('./patch-public-contacts');
const bundlePath = path.join(__dirname, '..', 'public', 'assets', 'index-CXxrK7KP.js');

test('public website property and general-contact buttons use the shared contact number', () => {
  const source = fs.readFileSync(bundlePath, 'utf8');
  const patched = patchPublicContacts(source);

  assert.ok(patched.includes('https://wa.me/923011484303?text=${n}'));
  assert.ok(patched.includes('https://wa.me/923011484303?text=I\'m interested in property #${n}'));
  assert.ok(patched.includes('tel:03011484303'));
  assert.ok(patched.includes('children:"03011484303"'));
  assert.ok(patched.includes('+923011484303'));
  assert.ok(!patched.includes('+92 300 1234567'));
  assert.ok(patched.includes('https://wa.me/923011484303'));
  assert.ok(patched.includes('tel:${d.phone}'), 'lead-record actions must keep the lead phone');
  assert.ok(patched.includes('wa.me/${d.phone.replace(/[^0-9]/g,"")}'));
  assert.ok(!patched.includes('wa.me/923001234567'));
  assert.ok(!patched.includes('wa.me/923042569000'));
});
