import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const api = readFileSync(new URL('../lib/api.ts', import.meta.url), 'utf8');

test('native media uploads use Expo File parts and Expo fetch', () => {
  assert.match(api, /import \{ File \} from 'expo-file-system'/);
  assert.match(api, /import \{ fetch as expoFetch \} from 'expo\/fetch'/);
  assert.match(api, /import \{ manipulateAsync, SaveFormat \} from 'expo-image-manipulator'/);
  assert.match(api, /async function apiUpload[\s\S]*?const res = await expoFetch/);
  assert.match(api, /async function imageUploadFile[\s\S]*?format: SaveFormat\.JPEG/);
  assert.match(api, /maxEdge: 1600, quality: 0\.68/);
  assert.match(api, /maxEdge: 1280, quality: 0\.5/);
  assert.match(api, /uploadFile\.size <= maxUploadBytes/);
  assert.match(api, /uploadFile\.size > 1\.5 \* 1024 \* 1024/);
  assert.match(api, /new File\(normalized\.uri\)/);
  assert.match(api, /form\.append\('image', uploadFile\.file, uploadFile\.filename\)/);
  assert.match(api, /form\.append\('video', new File\(uri\), filename\)/);
  assert.match(api, /form\.append\('images', uploadFile\.file, uploadFile\.filename\)/);
  assert.doesNotMatch(api, /form\.append\('(image|video|images)',\s*\{\s*uri,/);
});

test('generic server errors and media-storage failures are not retried through the legacy route', () => {
  const compatibilityCheck = api.match(/function isUploadCompatibilityError[\s\S]*?\n}/)?.[0] ?? '';
  assert.match(compatibilityCheck, /MEDIA_STORAGE_WRITE_FAILED/);
  assert.match(compatibilityCheck, /UPLOAD_FILE_TOO_LARGE/);
  assert.match(compatibilityCheck, /UPLOAD_FORMAT_NOT_SUPPORTED/);
  assert.match(compatibilityCheck, /\[400, 404, 415, 422\]/);
  assert.doesNotMatch(compatibilityCheck, /500|502|503|413/);
});
