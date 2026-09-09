import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import {
  createMapAreaRadiusInjection,
  createMapAreaRadiusMessage,
  formatMapAreaRange,
  MAP_AREA_RANGE_STEPS,
} from '../components/mapRadius';
import { cities, okaraDistrict } from '../lib/cities';

const mobileRoot = resolve(import.meta.dirname, '..');
const readComponent = (name: string) =>
  readFileSync(resolve(mobileRoot, 'components', name), 'utf8');
const readMobileFile = (name: string) =>
  readFileSync(resolve(mobileRoot, name), 'utf8');

test('every selectable radius has a concrete user-facing label', () => {
  assert.deepEqual(
    MAP_AREA_RANGE_STEPS.map(formatMapAreaRange),
    ['400 Meters', '900 Meters', '4 Kilometers', '10 Kilometers'],
  );

  for (const radiusKm of MAP_AREA_RANGE_STEPS) {
    const label = formatMapAreaRange(radiusKm);
    assert.notEqual(label, 'undefined');
    assert.doesNotMatch(label, /NaN|Infinity/);
  }
});

test('invalid radius values fall back to a safe label and never cross either bridge', () => {
  assert.equal(formatMapAreaRange(Number.NaN), '400 Meters');
  assert.equal(formatMapAreaRange(0), '400 Meters');
  assert.equal(createMapAreaRadiusMessage(Number.NaN), null);
  assert.equal(createMapAreaRadiusMessage(0), null);
  assert.equal(createMapAreaRadiusInjection(Number.POSITIVE_INFINITY), null);
});

test('web radius updates resize the existing circle without rebuilding the viewport', () => {
  const web = readComponent('ExploreMapView.tsx');

  assert.deepEqual(createMapAreaRadiusMessage(0.4), {
    type: 'mapAreaRadius',
    radiusKm: 0.4,
    fit: false,
  });
  assert.match(web, /createMapAreaRadiusMessage\(radiusKm, fit\)/);
  assert.match(web, /areaCircle\.setRadius\(radiusKm \* 1000\)/);
  assert.match(web, /\[properties, selectedId, userLat, userLng, centerLat, centerLng\]/);
  const htmlMemo = web.match(
    /const html = useMemo\([\s\S]*?\n\s*\);/,
  )?.[0];
  assert.ok(htmlMemo);
  assert.doesNotMatch(
    htmlMemo,
    /areaRadiusKm/,
  );
});

test('Android map overrides reuse native Google Maps instead of Leaflet', () => {
  const androidMap = readComponent('MapViewComponent.android.tsx');
  const androidExplore = readComponent('ExploreMapView.android.tsx');
  const nativeMap = readComponent('MapViewComponent.native.tsx');
  const nativeExplore = readComponent('ExploreMapView.native.tsx');

  assert.match(androidMap, /MapViewComponent\.native/);
  assert.match(androidExplore, /ExploreMapView\.native/);
  assert.doesNotMatch(androidMap, /Leaflet|WebView/);
  assert.doesNotMatch(androidExplore, /Leaflet|WebView/);
  assert.match(nativeMap, /const PROVIDER = PROVIDER_GOOGLE/);
  assert.match(nativeExplore, /const PROVIDER = PROVIDER_GOOGLE/);
});

test('native builds register the Google Maps SDK key through the maps config plugin', () => {
  const appConfig = readMobileFile('app.config.js');

  assert.match(appConfig, /['"]react-native-maps['"]/);
  assert.match(appConfig, /androidGoogleMapsApiKey:\s*googleMapsApiKey/);
  assert.match(appConfig, /iosGoogleMapsApiKey:\s*googleMapsApiKey/);
  assert.match(appConfig, /Google Maps SDK key is missing/);
});

test('Search this area stays available after a map move and a radius change', () => {
  const web = readComponent('ExploreMapView.tsx');
  const native = readComponent('ExploreMapView.native.tsx');

  assert.match(web, /setShowSearchArea\(true\)/);
  assert.match(web, /onSearchArea\(lastBounds\.current\)/);
  assert.match(native, /setShowSearchArea\(true\)/);
  assert.match(native, /onSearchArea\(\{/);
  assert.match(native, /onChange=\{handleAreaRadiusChange\}/);
});

test('native maps expose loading, retry, and exact map-area bounds behavior', () => {
  const native = readComponent('ExploreMapView.native.tsx');
  assert.match(native, /Loading Google Maps/);
  assert.match(native, /Google Maps could not load/);
  assert.match(native, /Retry map/);
  assert.match(native, /north: currentRegion\.latitude \+ currentRegion\.latitudeDelta \/ 2/);
  assert.match(native, /centerLat: currentRegion\.latitude/);
});

test('Okara district keeps city and tehsil identities separate', () => {
  assert.deepEqual([...cities], [
    'Okara',
    'Depalpur',
    'Renala Khurd',
    'Hujra Shah Muqeem',
    'Basirpur',
    'Haveli Lakha',
  ]);
  assert.equal(okaraDistrict.tehsils.includes('Depalpur'), true);
  assert.equal(okaraDistrict.tehsils.includes('Renala Khurd'), true);
  assert.notEqual(okaraDistrict.areas.Depalpur, okaraDistrict.areas.Okara);
  assert.ok(okaraDistrict.areas['Hujra Shah Muqeem'].length > 0);
});