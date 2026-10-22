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

test('Admin property editor supports a draggable Map/Satellite pin and saves coordinates', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'admin', 'index.html'), 'utf8');
  assert.match(source, /name="lat" type="number"/);
  assert.match(source, /name="lng" type="number"/);
  assert.match(source, /data-map-mode="map"/);
  assert.match(source, /data-map-mode="satellite"/);
  assert.match(source, /tile\.openstreetmap\.org/);
  assert.match(source, /ArcGIS\/rest\/services\/World_Imagery/);
  assert.match(source, /map\.on\('click', \(event\) => setPin\(event\.latlng\)\)/);
  assert.match(source, /marker\.on\('dragend'/);
  assert.match(source, /lat, lng, latitude: lat, longitude: lng/);
  assert.match(html, /admin-property-management\.js\?v=property-edit-live-data-20261022/);
});

test('property table edit action matches the listing title anywhere in the row', () => {
  assert.match(source, /const rowText = normalize\(row\.innerText\)/);
  assert.match(source, /rowText\.includes\(propertyTitle\)/);
  assert.match(source, /button\.textContent !== 'Edit listing'/);
});

test('property editor loads admin listings directly instead of depending on the dashboard fetch implementation', () => {
  assert.match(source, /request\('\/admin\/properties\?limit=500'\)/);
  assert.match(source, /properties = propertyList\(payload\)/);
  assert.match(source, /void loadPropertyData\(\)/);
  assert.match(source, /Edit controls unavailable:/);
});

test('Admin property deletion requires confirmation and uses the authenticated delete endpoint', () => {
  assert.match(source, /data-delete>Delete property/);
  assert.match(source, /Permanently delete/);
  assert.match(source, /request\(`\/admin\/properties\/\$\{encodeURIComponent\(property\.id\)\}`, \{ method: 'DELETE' \}\)/);
});

test('Laravel validates and persists admin-edited map coordinates in both property location shapes', () => {
  const apiController = fs.readFileSync(
    path.join(__dirname, '..', '..', 'api-server', 'laravel', 'app', 'Http', 'Controllers', 'ApiController.php'),
    'utf8',
  );
  assert.match(apiController, /'lat' => \['sometimes', 'nullable', 'numeric', 'between:-90,90'\]/);
  assert.match(apiController, /'lng' => \['sometimes', 'nullable', 'numeric', 'between:-180,180'\]/);
  assert.match(apiController, /\$location\['latitude'\] = \$lat/);
  assert.match(apiController, /\$location\['longitude'\] = \$lng/);
});
