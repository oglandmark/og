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

test('web radius updates resize the existing circle without rebuilding the viewport', () => {
  const web = readComponent('ExploreMapView.tsx');

  assert.deepEqual(createMapAreaRadiusMessage(0.4), {
    type: 'mapAreaRadius',
    radiusKm: 0.4,
  });
  assert.match(web, /createMapAreaRadiusMessage\(radiusKm\)/);
  assert.match(web, /areaCircle\.setRadius\(radiusKm \* 1000\)/);
  assert.match(web, /\[properties, selectedId, userLat, userLng\]/);
  const htmlMemo = web.match(
    /const html = useMemo\([\s\S]*?\n\s*\);/,
  )?.[0];
  assert.ok(htmlMemo);
  assert.doesNotMatch(
    htmlMemo,
    /areaRadiusKm/,
  );
});

test('Android radius updates inject into the existing WebView map', () => {
  const androidMap = readComponent('AndroidLeafletMap.tsx');
  const androidExplore = readComponent('ExploreMapView.android.tsx');

  assert.equal(
    createMapAreaRadiusInjection(10),
    'if (window.__setAreaRadius) window.__setAreaRadius(10); true;',
  );
  assert.match(androidMap, /createMapAreaRadiusInjection\(Number\(props\.areaRadiusKm\)\)/);
  assert.match(androidMap, /areaCircle\.setRadius\(nextRadius \* 1000\)/);

  const radiusSetter = androidMap.match(
    /window\.__setAreaRadius = function\(radiusKm\) \{[\s\S]*?\n\s*\};/,
  )?.[0];
  assert.ok(radiusSetter);
  assert.doesNotMatch(radiusSetter, /setView|fitBounds/);

  const htmlMemo = androidMap.match(
    /const html = useMemo\([\s\S]*?\n\s*\]\);/,
  )?.[0];
  assert.ok(htmlMemo);
  assert.doesNotMatch(htmlMemo, /areaRadiusKm/);
  assert.match(androidExplore, /areaRadiusKm=\{areaRadiusKm\}/);
});

test('Search this area stays available after a map move and a radius change', () => {
  const web = readComponent('ExploreMapView.tsx');
  const android = readComponent('ExploreMapView.android.tsx');

  const webRadiusListener = web.match(
    /window\.addEventListener\('message',[\s\S]*?areaCircle\.setRadius\(radiusKm \* 1000\);[\s\S]*?\n\s*\}\);/,
  )?.[0];
  assert.ok(webRadiusListener);
  assert.doesNotMatch(webRadiusListener, /classList\.remove\(['"]show['"]\)/);
  assert.match(web, /map\.on\('moveend zoomend', function\(\) \{[\s\S]*?classList\.add\('show'\)/);
  assert.match(web, /window\.parent\.postMessage\(\{ type: 'mapSearchArea'/);

  assert.match(android, /setShowSearch\(true\)/);
  assert.match(android, /onChange=\{setAreaRadiusKm\}/);
  assert.match(android, /onSearchArea\(bounds\)/);
});