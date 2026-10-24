import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { selectLatestProperties } from '../lib/latestProperties';

const home = readFileSync(new URL('../app/(tabs)/index.tsx', import.meta.url), 'utf8');
const properties = [
  { id: 1, createdAt: '2026-01-01T00:00:00Z' },
  { id: 2, createdAt: '2026-03-01T00:00:00Z' },
  { id: 3, createdAt: '2026-03-01T00:00:00Z' },
  { id: 4, isDemo: true },
];

test('mobile Latest uses the newest live listings, with id as a stable tie-breaker', () => {
  assert.deepEqual(
    selectLatestProperties(properties).map(({ id }) => id),
    [3, 2, 1],
  );
});

test('bundled listings remain the Latest fallback only when live listings are unavailable', () => {
  assert.deepEqual(
    selectLatestProperties(properties, true).map(({ id }) => id),
    [4],
  );
});

test('mobile Latest is limited to six properties', () => {
  const many = Array.from({ length: 9 }, (_, id) => ({ id, createdAt: `2026-03-${String(id + 1).padStart(2, '0')}T00:00:00Z` }));
  assert.equal(selectLatestProperties(many).length, 6);
});

test('section titles can wrap instead of clipping beside the View all button', () => {
  assert.match(home, /sectionHeaderContent/);
  assert.match(home, /numberOfLines=\{2\} style=\{\[s\.sectionTitle/);
});
