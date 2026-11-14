import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const appConfig = JSON.parse(readFileSync(
  fileURLToPath(new URL('../app.json', import.meta.url)),
  'utf8',
)).expo;

test('iOS keeps the production bundle ID and enables iPad support', () => {
  assert.equal(appConfig.ios.bundleIdentifier, 'com.oglandmark.app');
  assert.equal(appConfig.ios.supportsTablet, true);
  assert.equal(appConfig.version, '5.1.7');
  assert.equal(appConfig.ios.buildNumber, '62');
});

test('iPad support does not unlock Android landscape behavior', () => {
  assert.equal(appConfig.orientation, 'portrait');
  assert.equal(appConfig.android.package, 'com.oglandmark.app');
  assert.equal(appConfig.android.versionCode, 67);
});

test('Expo build metadata matches the connected owner and existing project', () => {
  assert.equal(appConfig.owner, 'og-landmark');
  assert.equal(appConfig.extra.eas.projectId, 'e1d0d001-f2f1-47d6-ac6a-480298d77e2d');
});

test('iOS-only purpose strings do not add Android image-picker permissions', () => {
  assert.match(appConfig.ios.infoPlist.NSPhotoLibraryUsageDescription, /create listings/);
  assert.match(appConfig.ios.infoPlist.NSCameraUsageDescription, /take a listing/);
  assert.ok(!appConfig.plugins.some(
    (plugin: string | [string, Record<string, unknown>]) =>
      Array.isArray(plugin) && plugin[0] === 'expo-image-picker',
  ));
  assert.ok(appConfig.plugins.includes('expo-notifications'));
});
