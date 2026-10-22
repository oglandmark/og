const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'admin', 'admin-property-management.js'),
  'utf8',
);

test('Admin property editor can remove existing photos and upload replacements', () => {
  assert.match(source, /data-edit-images/);
  assert.match(source, /Remove listing photo/);
  assert.match(source, /name="photoUploads" type="file"[^>]*multiple/);
  assert.match(source, /request\('\/upload\/multiple', \{ method: 'POST', body: formData \}\)/);
  assert.match(source, /images = \[\.\.\.images, \.\.\.uploadedUrls\]/);
});

test('Admin property editor can replace or remove a listing video', () => {
  assert.match(source, /name="videoUpload" type="file"/);
  assert.match(source, /name="removeVideo" type="checkbox"/);
  assert.match(source, /request\('\/upload\/video', \{ method: 'POST', body: formData \}\)/);
  assert.match(source, /videoUrl = null/);
});

test('Property media uploads use multipart requests without a JSON content type', () => {
  assert.match(source, /const multipart = typeof FormData !== 'undefined' && options\.body instanceof FormData/);
  assert.match(source, /options\.body && !multipart \? \{ 'Content-Type': 'application\/json' \}/);
});
