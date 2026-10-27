const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const source = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'admin', 'admin-property-management.js'),
  'utf8',
);
const listingMediaSource = fs.readFileSync(
  path.join(__dirname, '..', 'public', 'admin', 'admin-listing-media.js'),
  'utf8',
);

test('Admin property editor can remove existing photos and upload replacements', () => {
  assert.match(source, /data-edit-images/);
  assert.match(source, /Remove listing photo/);
  assert.match(source, /name="photoUploads" type="file"[^>]*multiple/);
  assert.match(source, /mediaForm\.append\('newImages\[\]', file\)/);
  assert.match(source, /request\(`\/admin\/properties\/\$\{encodeURIComponent\(property\.id\)\}\/media`/);
  assert.match(source, /mediaForm\.append\('images', JSON\.stringify\(images\)\)/);
});

test('Admin property editor can replace or remove a listing video', () => {
  assert.match(source, /name="videoUpload" type="file"/);
  assert.match(source, /name="removeVideo" type="checkbox"/);
  assert.match(source, /mediaForm\.append\('video', videoFile\)/);
  assert.match(source, /accept="\.mp4,\.mov"/);
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
  assert.match(html, /admin-property-management\.js\?v=[^"']+/);
  assert.match(html, /admin-listing-media\.js\?v=[^"']+/);
});

test('property table edit action matches the listing title anywhere in the row', () => {
  assert.match(source, /const rowText = normalize\(row\.innerText\)/);
  assert.match(source, /rowText\.includes\(propertyTitle\)/);
  assert.match(source, /button\.textContent !== 'Edit listing'/);
  assert.match(source, /window\.__ogOpenPropertyEditor = openPropertyEditor/);
  assert.match(listingMediaSource, /function ensureManageAction\(table, row, property\)/);
  assert.match(listingMediaSource, /button\.textContent = 'Edit listing'/);
  assert.match(listingMediaSource, /__ogOpenPropertyEditor\(current, button\)/);
});

test('property editor loads admin listings directly instead of depending on the dashboard fetch implementation', () => {
  assert.match(source, /request\('\/admin\/properties(?:\?limit=500)?'\)/);
  assert.match(source, /setPropertyData\(payload\)/);
  assert.match(source, /void loadPropertyData\(\)/);
  assert.match(source, /Edit controls unavailable:/);
  assert.match(source, /og-admin-properties-loaded/);
  assert.match(source, /__ogAdminListingProperties/);
  assert.match(source, /__ogListingProperty/);
  assert.match(listingMediaSource, /__ogAdminListingProperties = properties/);
  assert.match(listingMediaSource, /dispatchEvent\(new windowRef\.CustomEvent\('og-admin-properties-loaded'/);
});

test('Admin property deletion requires confirmation and uses the authenticated delete endpoint', () => {
  assert.match(source, /data-delete>Delete property/);
  assert.match(source, /Permanently delete/);
  assert.match(source, /request\(`\/admin\/properties\/\$\{encodeURIComponent\(property\.id\)\}`, \{ method: 'DELETE' \}\)/);
});

test('Admin listing edits keep map coordinates in the property payload', () => {
  assert.match(source, /lat, lng, latitude: lat, longitude: lng/);
});

test('Listing media is omitted from the legacy property update and sent to Laravel separately', () => {
  const saveSource = source.slice(
    source.indexOf('async function saveProperty'),
    source.indexOf('async function deleteProperty', source.indexOf('async function saveProperty')),
  );
  const payloadStart = saveSource.indexOf('const payload = {');
  const payloadEnd = saveSource.indexOf('};', payloadStart);
  const legacyPayload = saveSource.slice(payloadStart, payloadEnd);
  assert.doesNotMatch(legacyPayload, /\b(images|videoUrl|coverImage)\b/);
  assert.match(saveSource, /mediaForm\.append\('_method', 'PATCH'\)/);
  assert.match(saveSource, /method: 'POST',\s*body: mediaForm/);
});

test('Laravel admin media route stores edits with moderation and the preview rewrites the media request', () => {
  const routes = fs.readFileSync(
    path.join(__dirname, '..', '..', 'api-server', 'laravel', 'routes', 'api.php'),
    'utf8',
  );
  const controller = fs.readFileSync(
    path.join(__dirname, '..', '..', 'api-server', 'laravel', 'app', 'Http', 'Controllers', 'Api', 'AdminController.php'),
    'utf8',
  );
  assert.match(routes, /Route::patch\('\/admin\/properties\/\{id\}\/media', \[AdminController::class, 'updatePropertyMedia'\]\)/);
  assert.match(controller, /A property can have at most 30 images/);
  assert.match(controller, /deleteUnreferencedPropertyMedia/);
  assert.match(controller, /action' => 'media_updated'/);
});
