import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { setMapViewModeForFrame } from '../components/MapViewModes';
import {
  createMapAreaRadiusInjection,
  createMapAreaRadiusMessage,
  formatMapAreaRange,
  mapAreaRadiusMeters,
  MAP_AREA_RANGE_STEPS,
  normalizeMapAreaRange,
} from '../components/mapRadius';
import { cities, okaraDistrict } from '../lib/cities';

const mobileRoot = resolve(import.meta.dirname, '..');
const readComponent = (name: string) =>
  readFileSync(resolve(mobileRoot, 'components', name), 'utf8');

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

test('the selected range uses one clamped kilometer-to-meter conversion everywhere', () => {
  assert.equal(normalizeMapAreaRange(0.4), 0.4);
  assert.equal(normalizeMapAreaRange(0.93), 0.9);
  assert.equal(normalizeMapAreaRange(25), 10);
  assert.equal(mapAreaRadiusMeters(0.4), 400);
  assert.equal(mapAreaRadiusMeters(0.9), 900);
  assert.equal(mapAreaRadiusMeters(4), 4000);
  assert.equal(mapAreaRadiusMeters(10), 10000);
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
  assert.match(web, /\[properties, selectedId, userLat, userLng, centerLat, centerLng, channel, mapGlass, mapGlassBorder\]/);
  const htmlMemo = web.match(
    /const html = useMemo\([\s\S]*?\n\s*\);/,
  )?.[0];
  assert.ok(htmlMemo);
  assert.doesNotMatch(
    htmlMemo,
    /areaRadiusKm/,
  );
});

test('Android map overrides reuse the shared Mapbox WebView implementation', () => {
  const androidMap = readComponent('MapViewComponent.android.tsx');
  const androidExplore = readComponent('ExploreMapView.android.tsx');
  const nativeMap = readComponent('MapViewComponent.native.tsx');
  const nativeExplore = readComponent('ExploreMapView.native.tsx');

  assert.match(androidMap, /MapViewComponent\.native/);
  assert.match(androidExplore, /ExploreMapView\.native/);
  assert.match(nativeMap, /ExpoGoMapFallback/);
  assert.match(nativeExplore, /ExpoGoMapFallback/);
  assert.match(nativeMap, /satellite=\{satellite\}/);
  assert.match(readComponent('ExpoGoMapFallback.tsx'), /EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN/);
});

test('map surfaces expose Map and Satellite modes without Street View', () => {
  const controls = readComponent('MapViewModes.ts');
  const controlComponent = readComponent('MapViewModeControl.tsx');
  const nativeFallback = readComponent('ExpoGoMapFallback.tsx');
  const nativeExplore = readComponent('ExploreMapView.native.tsx');
  const webMap = readComponent('MapViewComponent.tsx');
  const webExplore = readComponent('ExploreMapView.tsx');
  const exploreScreen = readFileSync(
    resolve(mobileRoot, 'app', '(tabs)', 'explore.tsx'),
    'utf8',
  );

  assert.match(controlComponent, /label: 'Map'/);
  assert.match(controlComponent, /label: 'Satellite'/);
  assert.doesNotMatch(controlComponent, /Street View/);
  assert.match(controlComponent, /backgroundColor: '#ffffff'/);
  assert.match(controlComponent, /icon: 'map-marked-alt'/);
  assert.match(controlComponent, /icon: 'satellite'/);
  assert.match(controlComponent, /backdropFilter: 'blur\(14px\)'/);
  assert.match(controlComponent, /flexDirection: 'row'/);
  assert.match(controlComponent, /buttonHeight\?: number/);
  assert.match(controlComponent, /height: buttonHeight, minHeight: buttonHeight/);
  assert.match(controlComponent, /map-view-mode-\$\{option\.value\}/);
  assert.match(controlComponent, /top\?: number/);
  for (const source of [nativeFallback, webMap, webExplore]) {
    assert.match(source, /MapViewModeControl/);
    assert.match(source, /MAP_VIEW_MODE_SWITCH_SCRIPT/);
    assert.doesNotMatch(source, /street-view|Street View|EXPO_PUBLIC_GOOGLE_MAPS_API_KEY/);
  }
  assert.match(nativeFallback, /__setMapViewMode/);
  assert.match(nativeFallback, /top=\{props\.modeControlTop\}/);
  assert.match(nativeFallback, /buttonHeight=\{props\.modeControlButtonHeight\}/);
  assert.match(nativeExplore, /modeControlTop=\{fullScreen \? 60 : 100\}/);
  assert.match(nativeExplore, /modeControlButtonHeight=\{38\}/);
  assert.match(webMap, /top=\{78\}/);
  assert.match(webMap, /og-map-view-mode/);
  assert.match(webExplore, /top=\{fullScreen \? 52 : 100\}/);
  assert.match(webExplore, /left=\{fullScreen \? 60 : 12\}/);
  assert.match(webExplore, /horizontal=\{Boolean\(fullScreen\)\}/);
  assert.match(webExplore, /og-map-view-mode/);
  assert.match(exploreScreen, /height: Platform\.OS === 'web' \? 30 : 38/);
  assert.match(exploreScreen, /minHeight: Platform\.OS === 'web' \? 30 : 38/);
  assert.doesNotMatch(controls, /streetview|Street View/);
  assert.match(webMap, /setMapViewModeForFrame/);
  assert.match(webExplore, /setMapViewModeForFrame/);
});

test('web map mode controls update loaded frames directly and message unloaded frames', () => {
  const directCalls: string[] = [];
  setMapViewModeForFrame({
    __setMapViewMode: (mode: 'map' | 'satellite') => directCalls.push(mode),
    postMessage: () => assert.fail('loaded frames should be updated directly'),
  } as unknown as Window, 'test-map', 'satellite');
  assert.deepEqual(directCalls, ['satellite']);

  const messages: unknown[] = [];
  setMapViewModeForFrame({
    postMessage: (message: unknown) => messages.push(message),
  } as unknown as Window, 'test-map', 'map');
  assert.deepEqual(messages, [{
    channel: 'test-map',
    type: 'og-map-view-mode',
    mode: 'map',
  }]);
});

test('full-screen map does not render a Search this area action', () => {
  const web = readComponent('ExploreMapView.tsx');
  const native = readComponent('ExploreMapView.native.tsx');

  assert.doesNotMatch(web, /Search this area/);
  assert.doesNotMatch(native, /Search this area/);
  assert.match(native, /onChange=\{setAreaRadiusKm\}/);
});

test('native Mapbox maps keep the area center synced after map movement', () => {
  const native = readComponent('ExploreMapView.native.tsx');
  assert.match(native, /setAreaCenter\(\{ latitude: region\.latitude, longitude: region\.longitude \}\)/);
});

test('Expo Go map keeps its WebView mounted, supports touch gestures, and follows the map center', () => {
  const fallback = readComponent('ExpoGoMapFallback.tsx');
  const native = readComponent('ExploreMapView.native.tsx');
  assert.match(fallback, /initialHtmlRef/);
  assert.match(fallback, /window\.__updateMapState/);
  assert.match(fallback, /window\.__zoomMap/);
  assert.match(fallback, /scrollEnabled=\{false\}/);
  assert.match(fallback, /overScrollMode="never"/);
  assert.match(fallback, /touchZoom: false/);
  assert.match(fallback, /pinchStartDistance/);
  assert.match(fallback, /areaCircle\.setLatLng\(map\.getCenter\(\)\)/);
  assert.match(fallback, /areaCircle\.setRadius\(nextRadius\)/);
  assert.match(native, /setAreaCenter\(\{ latitude: region\.latitude, longitude: region\.longitude \}\)/);
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