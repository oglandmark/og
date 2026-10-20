import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const api = readFileSync(new URL('../lib/api.ts', import.meta.url), 'utf8');

test('native media uploads use Expo File parts and Expo fetch', () => {
  assert.match(api, /import \{ File \} from 'expo-file-system'/);
  assert.match(api, /import \{ fetch as expoFetch \} from 'expo\/fetch'/);
  assert.match(api, /async function apiUpload[\s\S]*?const res = await expoFetch/);
  assert.match(api, /function imageUploadFile[\s\S]*?new File\(uri\)/);
  assert.match(api, /form\.append\('image', uploadFile\.file, uploadFile\.filename\)/);
  assert.match(api, /form\.append\('video', new File\(uri\), filename\)/);
  assert.match(api, /form\.append\('images', uploadFile\.file, uploadFile\.filename\)/);
  assert.doesNotMatch(api, /form\.append\('(image|video|images)',\s*\{\s*uri,/);
});
