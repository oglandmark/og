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

test('Android native map uses Google Maps while the other native map paths retain Mapbox', () => {
  const androidMap = readComponent('MapViewComponent.android.tsx');
  const androidExplore = readComponent('ExploreMapView.android.tsx');
  const nativeMap = readComponent('MapViewComponent.native.tsx');
  const nativeExplore = readComponent('ExploreMapView.native.tsx');
  const googleMap = readComponent('GoogleMapCanvas.tsx');
  const eas = JSON.parse(readFileSync(resolve(mobileRoot, 'eas.json'), 'utf8'));
  const keyPlugin = readFileSync(
    resolve(mobileRoot, 'plugins/withGoogleMapsApiKey.js'),
    'utf8',
  );

  assert.match(androidMap, /MapViewComponent\.native/);
  assert.match(androidExplore, /ExploreMapView\.native/);
  assert.match(nativeMap, /Platform\.OS === 'android'/);
  assert.match(nativeExplore, /Platform\.OS === 'android'/);
  assert.match(nativeMap, /GoogleMapCanvas/);
  assert.match(nativeExplore, /GoogleMapCanvas/);
  assert.match(nativeMap, /satellite=\{satellite\}/);
  assert.match(googleMap, /provider=\{PROVIDER_GOOGLE\}/);
  assert.match(googleMap, /mapType=\{mapMode === 'satellite' \? 'satellite' : 'standard'\}/);
  assert.match(googleMap, /radius=\{radiusKm \* 1000\}/);
  assert.match(keyPlugin, /EXPO_PUBLIC_GOOGLE_MAPS_API_KEY/);
  assert.match(keyPlugin, /com\.google\.android\.geo\.API_KEY/);
  assert.equal(eas.build.preview.environment, 'production');
  assert.equal(eas.build.preview.distribution, 'internal');
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
  assert.match(exploreScreen, /FontAwesome5 name="map-marked-alt"/);
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

test('full-screen map lets users show the selected radius results in Explore', () => {
  const web = readComponent('ExploreMapView.tsx');
  const native = readComponent('ExploreMapView.native.tsx');
  const range = readComponent('MapAreaRange.tsx');
  const explore = readFileSync(resolve(mobileRoot, 'app/(tabs)/explore.tsx'), 'utf8');

  assert.match(web, /onApply=\{fullScreen && onApplyArea/);
  assert.match(native, /onApply=\{fullScreen && onApplyArea/);
  assert.match(range, /Show \{resultCount\} properties in Explore/);
  assert.match(explore, /onApplyArea=\{applyMapAreaSearch\}/);
  assert.match(explore, /setMapAreaSearch\(area\)/);
  assert.match(explore, /nearMe \?\? searchedPlace \?\? mapAreaSearch/);
  assert.match(native, /onChange=\{setAreaRadiusKm\}/);
});

test('Explore map opens in street-map mode by default', () => {
  const web = readComponent('ExploreMapView.tsx');
  const native = readComponent('ExploreMapView.native.tsx');
  const fallback = readComponent('ExpoGoMapFallback.tsx');

  assert.match(web, /var currentMapMode = 'map'/);
  assert.match(web, /useState<MapViewMode>\('map'\)/);
  assert.doesNotMatch(native, /\bsatellite\b/);
  assert.match(fallback, /useState<MapViewMode>\(props\.satellite \? 'satellite' : 'map'\)/);
});

test('listing location picker follows the selected city with a fixed center pin and persistent zoom', () => {
  const picker = readComponent('LocationPicker.tsx');
  const nativeMap = readComponent('MapViewComponent.native.tsx');
  const webMap = readComponent('MapViewComponent.tsx');
  const fallback = readComponent('ExpoGoMapFallback.tsx');
  const postAd = readFileSync(resolve(mobileRoot, 'app/(tabs)/post-ad.tsx'), 'utf8');
  const home = readFileSync(resolve(mobileRoot, 'app/(tabs)/index.tsx'), 'utf8');

  const postAdPickers = [...postAd.matchAll(/<LocationPicker[\s\S]*?\/>/g)];
  assert.equal(postAdPickers.length, 3);
  assert.ok(postAdPickers.every(([pickerCall]) => /fullScreen/.test(pickerCall)));
  assert.match(picker, /setRegion\(getCityRegion\(city\)\)/);
  assert.match(picker, /regionCityKey !== selectedCityKey/);
  assert.match(picker, /if \(!fullScreen \|\| !nextRegion\.userGesture \|\| !centerMoved\) return;/);
  assert.match(picker, /Depalpur: \{ latitude: 30\.6698, longitude: 73\.6554,[^}]*zoom: 13 \}/);
  assert.match(picker, /Basirpur: \{ latitude: 30\.5802, longitude: 73\.8317,/);
  assert.match(picker, /'Haveli Lakha': \{ latitude: 30\.4508, longitude: 73\.6936,/);
  assert.match(home, /'Basirpur':\s+\{ lat: 30\.5802, lng: 73\.8317 \}/);
  assert.match(home, /'Haveli Lakha':\s+\{ lat: 30\.4508, lng: 73\.6936 \}/);
  assert.match(picker, /key=\{selectedCityKey \|\| 'default'\}/);
  assert.match(picker, /brandCenterPin/);
  assert.match(picker, /brandPinBody/);
  assert.match(picker, /centerPin/);
  assert.match(picker, /zoomControlsBottomRight/);
  assert.match(picker, /satellite=\{false\}/);
  assert.match(picker, /Move the map under the pin/);
  assert.match(nativeMap, /region\?\.latitude/);
  assert.match(nativeMap, /zoom=\{region\?\.zoom \?\? 14\}/);
  assert.match(nativeMap, /points=\{centerPin \? \[\] : \[/);
  assert.match(webMap, /draggable:\$\{interactive && !centerPin\}/);
  assert.match(webMap, /map\.zoomControl\.setPosition\('bottomright'\)/);
  assert.match(webMap, /zoom:map\.getZoom\(\)/);
  assert.match(webMap, /userGesture:userGestureActive/);
  assert.match(webMap, /touch-action:none/);
  assert.match(webMap, /zoomControl:\$\{interactive\}/);
  assert.match(fallback, /zoom: map\.getZoom\(\)/);
  assert.match(fallback, /accessibilityLabel="Zoom in map"/);
  assert.match(fallback, /accessibilityLabel="Zoom out map"/);
  assert.match(postAd, /if \(cityChanged\) \{[\s\S]*setLatitude\(null\);[\s\S]*setLongitude\(null\);[\s\S]*setSelectedLocation\(null\);[\s\S]*setLocationConfirmed\(false\);/);
});

test('native maps keep the area center synced after map movement', () => {
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
  assert.match(fallback, /userGesture: userGestureActive/);
  assert.match(fallback, /event\.stopPropagation\(\)/);
  assert.match(fallback, /regionReportTimer = setTimeout\(sendRegion, 100\)/);
  assert.match(fallback, /map\.setZoomAround\(pinchAnchor, nextZoom, \{ animate: false \}\)/);
  assert.match(fallback, /map\.dragging\.disable\(\)/);
  assert.match(fallback, /map\.dragging\.enable\(\)/);
  assert.match(fallback, /addEventListener\('touchcancel', cancelPinch/);
  assert.match(fallback, /capture: true/);
  assert.match(fallback, /zoomSnap: 0\.25/);
  assert.match(fallback, /areaCircle\.setLatLng\(map\.getCenter\(\)\)/);
  assert.match(fallback, /areaCircle\.setRadius\(nextRadius\)/);
  assert.match(native, /setAreaCenter\(\{ latitude: region\.latitude, longitude: region\.longitude \}\)/);
});

test('price-card pointer tips stay anchored to each property coordinate', () => {
  const web = readComponent('ExploreMapView.tsx');
  const fallback = readComponent('ExpoGoMapFallback.tsx');

  assert.match(web, /iconSize: \[\$\{markerWidth\}, 32\], iconAnchor: \[\$\{markerWidth \/ 2\}, 32\]/);
  assert.match(web, /og-pin-tip/);
  assert.match(fallback, /iconSize: point\.label \? \[priceWidth, 32\] : \[28, 28\]/);
  assert.match(fallback, /iconAnchor: point\.label \? \[priceWidth \/ 2, 32\] : \[14, 28\]/);
  assert.match(fallback, /price-pill-tip/);
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