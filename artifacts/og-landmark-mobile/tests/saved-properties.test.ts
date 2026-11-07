import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import type { Property } from '../lib/properties';
import { getLiveSavedPropertyIds, selectSavedProperties } from '../lib/savedProperties';

const savedScreen = readFileSync(new URL('../app/(tabs)/saved.tsx', import.meta.url), 'utf8');
const bundledDemo = {
  id: 1,
  title: 'Bundled sample',
  isDemo: true,
} as Property;
const liveProperty = { ...bundledDemo, id: 1, title: 'Live listing', isDemo: false };

test('saved live listings are matched by their API ID, not a colliding demo ID', () => {
  assert.deepEqual(
    selectSavedProperties([1], [bundledDemo], [liveProperty]).map(({ title }) => title),
    ['Live listing'],
  );
});

test('saved bundled demos keep their negative IDs and original demo visibility ID', () => {
  const saved = selectSavedProperties([-1], [bundledDemo], []);
  assert.equal(saved.length, 1);
  assert.equal(saved[0]!.id, -1);
  assert.equal(saved[0]!.demoId, 1);
});

test('live lookup IDs are positive, unique property IDs only', () => {
  assert.deepEqual(getLiveSavedPropertyIds([-1, 2, 2, 0, -4, 7]), [2, 7]);
});

test('Favorites screen loads live property records for saved API IDs', () => {
  assert.match(savedScreen, /Promise\.allSettled\(ids\.map\(\(id\) => getProperty\(id\)\)\)/);
  assert.match(savedScreen, /apiPropertyToProperty\(result\.value\)/);
});
